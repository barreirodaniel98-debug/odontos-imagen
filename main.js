const {app,BrowserWindow,Menu,dialog,ipcMain,shell}=require('electron');
const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib'),{promisify}=require('util'),dicomParser=require('dicom-parser');
const {filtrar,desfiltrar}=require('./vdc');
// ---- DICOM comprimido: RLE, deflate, JPEG sin pérdida y JPEG 2000 ----
const SIN_COMP=['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.1.99'],TS_LL=['1.2.840.10008.1.2.4.57','1.2.840.10008.1.2.4.70'],TS_J2K=['1.2.840.10008.1.2.4.90','1.2.840.10008.1.2.4.91'],TS_RLE='1.2.840.10008.1.2.5';
const inflater=(arr,pos)=>{const out=zlib.inflateRawSync(Buffer.from(arr.buffer,arr.byteOffset+pos,arr.length-pos)),full=new Uint8Array(pos+out.length);full.set(arr.subarray(0,pos));full.set(out,pos);return full;};
function rleDecode(f,rows,cols){ // cada segmento es un plano de bytes (primero el byte alto); PackBits
  const dv=new DataView(f.buffer,f.byteOffset,f.byteLength),ns=dv.getUint32(0,true),n=rows*cols,planos=[];
  for(let s=0;s<ns;s++){const ini=dv.getUint32(4+s*4,true),fin=s+1<ns?dv.getUint32(8+s*4,true)||f.length:f.length,pl=new Uint8Array(n);let i=ini,o=0;
    while(i<fin&&o<n){const c=f[i++]<<24>>24;if(c>=0){for(let k=0;k<=c&&o<n;k++)pl[o++]=f[i++];}else if(c!==-128){const v=f[i++];for(let k=0;k<1-c&&o<n;k++)pl[o++]=v;}}
    planos.push(pl);}
  if(planos.length!==2)throw new Error('RLE: se esperaban imágenes de 16 bits');
  const u=new Uint16Array(n);for(let i=0;i<n;i++)u[i]=(planos[0][i]<<8)|planos[1][i];return u;
}
let j2k=null;
async function pixeles(ds,b,px,ts,rows,cols,signed){
  if(SIN_COMP.includes(ts)){const raw=b.buffer.slice(b.byteOffset+px.dataOffset,b.byteOffset+px.dataOffset+rows*cols*2);return signed?new Int16Array(raw):new Uint16Array(raw);}
  const cod=dicomParser.readEncapsulatedPixelDataFromFragments(ds,px,0,px.fragments.length);
  if(ts===TS_RLE){const u=rleDecode(cod,rows,cols);return signed?new Int16Array(u.buffer):u;}
  if(TS_LL.includes(ts)){const o=new (require('jpeg-lossless-decoder-js').Decoder)().decode(cod.buffer.slice(cod.byteOffset,cod.byteOffset+cod.byteLength));return signed?new Int16Array(o.buffer.slice(o.byteOffset,o.byteOffset+o.byteLength)):new Uint16Array(o.buffer.slice(o.byteOffset,o.byteOffset+o.byteLength));}
  if(TS_J2K.includes(ts)){
    if(!j2k)j2k=await require('@cornerstonejs/codec-openjpeg')();
    const d=new j2k.J2KDecoder();d.getEncodedBuffer(cod.length).set(cod);d.decode();const fi=d.getFrameInfo(),out=d.getDecodedBuffer();
    const arr=fi.isSigned?new Int16Array(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength)):new Uint16Array(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength));d.delete&&d.delete();return arr;}
  throw new Error('Este DICOM usa un tipo de compresión que todavía no se lee ('+ts+'). Si puedes, expórtalo sin comprimir.');
}
const deflate=promisify(zlib.deflate),inflate=promisify(zlib.inflate);
let win,cur=null,sucio=false,pendiente=process.argv.find(a=>/\.(oim|vdc)$/.test(a))||null;

// ---- recientes ----
const recFile=()=>path.join(app.getPath('userData'),'recientes.json');
const leerRec=()=>{try{return JSON.parse(fs.readFileSync(recFile(),'utf8')).filter(r=>fs.existsSync(r.ruta));}catch{return[];}};
const addRec=(tipo,ruta,nombre)=>{const l=leerRec().filter(r=>r.ruta!==ruta);l.unshift({tipo,ruta,nombre,fecha:new Date().toISOString()});try{fs.writeFileSync(recFile(),JSON.stringify(l.slice(0,8)));}catch{}};

// ---- DICOM ----
const walk=(d,o=[])=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,o);else if(!e.name.startsWith('.'))o.push(p);}return o;};
// shortcut: solo DICOM sin comprimir (little endian) de 16 bits; vóxeles cuadrados no se remuestrean
async function cargar(dir){
  const series={};let pac=null;
  for(const f of walk(dir)){
    let ds,b;
    try{b=fs.readFileSync(f);ds=dicomParser.parseDicom(new Uint8Array(b.buffer,b.byteOffset,b.length),{inflater});}catch(e){continue;}
    const px=ds.elements.x7fe00010; if(!px)continue;
    const ts=ds.string('x00020010')||'1.2.840.10008.1.2';
    const rows=ds.uint16('x00280010'),cols=ds.uint16('x00280011'),bits=ds.uint16('x00280100');
    if(bits!==16)throw new Error('Solo se leen imágenes de 16 bits.');
    const ipp=(ds.string('x00200032')||'').split('\\').map(Number);
    const z=ipp.length===3?ipp[2]:Number(ds.string('x00200013')||0);
    const slope=Number(ds.string('x00281053')||1),inter=Number(ds.string('x00281052')||0),signed=ds.uint16('x00280103')===1;
    const a=await pixeles(ds,ds.byteArray,px,ts,rows,cols,signed),u=new Uint8Array(rows*cols);
    for(let i=0;i<u.length;i++){const q=((a[i]*slope+inter)+500)/3500*255;u[i]=q<0?0:q>255?255:q;}
    const ps=(ds.string('x00280030')||'1\\1').split('\\').map(Number);
    const uid=ds.string('x0020000e')||'?';
    if(!pac){const g=t=>(ds.string(t)||'').replace(/\^+/g,' ').trim();pac={nombre:g('x00100010'),id:g('x00100020'),nac:g('x00100030'),sexo:g('x00100040'),fecha:g('x00080020'),institucion:g('x00080080')};}
    (series[uid]=series[uid]||{rows,cols,sp:ps[0],sl:[]}).sl.push({z,u});
  }
  const s=Object.values(series).sort((a,b)=>b.sl.length-a.sl.length)[0];
  if(!s||s.sl.length<20)throw new Error('No encontré una serie DICOM 3D (CBCT) en esa carpeta.');
  s.sl.sort((a,b)=>a.z-b.z);
  const n=s.sl.length,vol=Buffer.alloc(n*s.rows*s.cols);
  s.sl.forEach((q,i)=>vol.set(q.u,i*s.rows*s.cols));
  const st=n>1?Math.abs(s.sl[1].z-s.sl[0].z):s.sp;
  return {meta:{nx:s.cols,ny:s.rows,nz:n,sp:s.sp,st,nombre:(pac&&pac.nombre)||path.basename(dir),paciente:pac},vol};
}
async function abrir(_e,dir,sec){
  if(!dir){const r=await dialog.showOpenDialog(win,{title:'Carpeta DICOM',properties:['openDirectory']});if(r.canceled)return null;dir=r.filePaths[0];}
  try{const r=await cargar(dir);if(!sec){cur={meta:r.meta,path:null};addRec('dicom',dir,r.meta.nombre);}return r;}catch(e){return {error:e.message};}
}

// ---- formato .oim (antes .vdc): "OIM1" + u32 largo de cabecera + cabecera JSON (meta, arcada, medidas, capturas, apuntes) + volumen deflate ----
async function abrirVdc(_e,p,sec){
  if(!p){const r=await dialog.showOpenDialog(win,{title:'Abrir caso',properties:['openFile'],filters:[{name:'Caso odontOS Imagen',extensions:['oim','vdc']}]});if(r.canceled)return null;p=r.filePaths[0];}
  try{
    const b=fs.readFileSync(p);
    if(!['OIM1','VDC1'].includes(b.subarray(0,4).toString()))throw new Error('Este archivo no es un caso de odontOS Imagen.');
    const hl=b.readUInt32LE(4),head=JSON.parse(b.subarray(8,8+hl).toString());
    let vol=await inflate(b.subarray(8+hl));if(head.filtro==='lud')vol=desfiltrar(vol,head.meta.nx,head.meta.ny);
    if(!sec){cur={meta:head.meta,path:p};addRec('vdc',p,head.state.nombre||head.meta.nombre);}
    return {meta:head.meta,vol,state:head.state,path:p};
  }catch(e){return {error:e.message};}
}
async function guardar(_e,state,como,vol){ // el volumen llega desde la ventana: así solo existe una copia en memoria
  if(!cur||!vol)return {error:'No hay ningún caso abierto'};
  let p=cur.path;
  if(!p||como){
    const r=await dialog.showSaveDialog(win,{title:'Guardar caso',defaultPath:p||path.join(app.getPath('documents'),(state.nombre||cur.meta.nombre)+'.oim'),filters:[{name:'Caso odontOS Imagen',extensions:['oim']}]});
    if(r.canceled)return null;p=r.filePath.endsWith('.oim')?r.filePath:r.filePath+'.oim';
  }
  try{
    const head=Buffer.from(JSON.stringify({v:1,filtro:'lud',meta:cur.meta,state,fecha:new Date().toISOString()})),len=Buffer.alloc(4);len.writeUInt32LE(head.length);
    const comp=await deflate(filtrar(vol,cur.meta.nx,cur.meta.ny),{level:4});
    fs.writeFileSync(p,Buffer.concat([Buffer.from('OIM1'),len,head,comp]));
    cur.path=p;addRec('vdc',p,state.nombre||cur.meta.nombre);
    return {path:p,mb:+(fs.statSync(p).size/1048576).toFixed(1)};
  }catch(e){return {error:e.message};}
}

// ---- PDF y PNG ----
async function informe(_e,html,nombre){
  const r=await dialog.showSaveDialog(win,{title:'Guardar informe',defaultPath:path.join(app.getPath('documents'),'Informe '+nombre+'.pdf'),filters:[{name:'PDF',extensions:['pdf']}]});
  if(r.canceled)return null;
  const tmp=path.join(os.tmpdir(),'informe-'+Date.now()+'.html');fs.writeFileSync(tmp,html);
  const w=new BrowserWindow({show:false});
  try{await w.loadFile(tmp);const pdf=await w.webContents.printToPDF({pageSize:'A4',printBackground:true});fs.writeFileSync(r.filePath,pdf);return r.filePath;}
  catch(e){return {error:e.message};}finally{w.destroy();fs.rmSync(tmp,{force:true});}
}
async function png(_e,dataUrl,nombre){
  const r=await dialog.showSaveDialog(win,{title:'Guardar captura',defaultPath:path.join(app.getPath('pictures'),nombre+'.png'),filters:[{name:'PNG',extensions:['png']}]});
  if(r.canceled)return null;fs.writeFileSync(r.filePath,Buffer.from(dataUrl.split(',')[1],'base64'));return r.filePath;
}

// ---- datos de la clínica (logo, doctor, firma): se guardan en la app, no en cada caso ----
const cfgFile=()=>path.join(app.getPath('userData'),'clinica.json');
ipcMain.handle('cfgLeer',()=>{try{return JSON.parse(fs.readFileSync(cfgFile(),'utf8'));}catch{return {};}});
ipcMain.handle('cfgGuardar',(_e,c)=>{try{fs.writeFileSync(cfgFile(),JSON.stringify(c));return true;}catch{return false;}});
ipcMain.handle('imagen',async()=>{
  const r=await dialog.showOpenDialog(win,{title:'Elegir imagen',properties:['openFile'],filters:[{name:'Imagen',extensions:['png','jpg','jpeg']}]});
  if(r.canceled)return null;const f=r.filePaths[0],mime=/\.png$/i.test(f)?'image/png':'image/jpeg';
  return 'data:'+mime+';base64,'+fs.readFileSync(f).toString('base64');
});
ipcMain.handle('abrir',abrir);ipcMain.handle('abrirVdc',abrirVdc);ipcMain.handle('guardar',guardar);
ipcMain.handle('informe',informe);ipcMain.handle('png',png);
ipcMain.handle('stl',async(_e,buf,nombre)=>{const r=await dialog.showSaveDialog(win,{title:'Guardar modelo 3D',defaultPath:path.join(app.getPath('documents'),nombre+'.stl'),filters:[{name:'STL',extensions:['stl']}]});
  if(r.canceled)return null;fs.writeFileSync(r.filePath,Buffer.from(buf));return r.filePath;});
ipcMain.handle('recientes',()=>leerRec());
ipcMain.handle('inicial',()=>{const v=pendiente;pendiente=null;return {dir:process.env.VISOR_DIR||null,vdc:v};});
ipcMain.on('sucio',(_e,v)=>{sucio=v;});

app.on('open-file',(e,p)=>{e.preventDefault();if(win&&win.webContents&&!win.webContents.isLoading())win.webContents.send('abrir-vdc',p);else pendiente=p;});
app.whenReady().then(()=>{
  win=new BrowserWindow({width:1500,height:920,backgroundColor:'#14161a',title:'odontOS Imagen',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,sandbox:false}});
  win.loadFile('index.html');
  win.on('close',e=>{if(sucio&&dialog.showMessageBoxSync(win,{type:'warning',buttons:['Cancelar','Cerrar sin guardar'],defaultId:0,cancelId:0,message:'Hay cambios sin guardar',detail:'Guarda el caso con Cmd+S para no perder las medidas, capturas y apuntes.'})===0)e.preventDefault();});
  const m=a=>()=>win.webContents.send('menu',a);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:app.name,submenu:[{role:'about'},{type:'separator'},{role:'quit',label:'Salir'}]},
    {label:'Archivo',submenu:[
      {label:'Abrir carpeta DICOM…',accelerator:'CmdOrCtrl+O',click:m('dicom')},
      {label:'Abrir caso guardado…',accelerator:'CmdOrCtrl+Shift+O',click:m('vdc')},
      {type:'separator'},
      {label:'Guardar caso',accelerator:'CmdOrCtrl+S',click:m('guardar')},
      {label:'Guardar como…',accelerator:'CmdOrCtrl+Shift+S',click:m('guardar-como')},
      {type:'separator'},
      {label:'Exportar informe PDF…',accelerator:'CmdOrCtrl+P',click:m('informe')}]},
    {label:'Edición',submenu:[{label:'Deshacer',accelerator:'CmdOrCtrl+Z',click:m('deshacer')},{label:'Rehacer',accelerator:'CmdOrCtrl+Shift+Z',click:m('rehacer')},{type:'separator'},{role:'cut',label:'Cortar'},{role:'copy',label:'Copiar'},{role:'paste',label:'Pegar'},{role:'selectAll',label:'Seleccionar todo'}]},
    {label:'Ver',submenu:[{role:'togglefullscreen'},{role:'reload'}]},
    {label:'Ayuda',submenu:[{label:'Atajos de teclado',accelerator:'CmdOrCtrl+/',click:m('ayuda')},{label:'Buscar actualizaciones…',click:m('actualizar')}]}]));
});
// Windows/Linux: doble clic en un .oim con la app abierta llega como segunda instancia
if(!app.requestSingleInstanceLock())app.quit();
else app.on('second-instance',(_e,argv)=>{const p=argv.find(x=>/\.(oim|vdc)$/.test(x));if(win){if(win.isMinimized())win.restore();win.focus();if(p)win.webContents.send('abrir-vdc',p);}});
app.on('window-all-closed',()=>app.quit());
// ---- actualizaciones: se consulta la última versión publicada en GitHub y se abre la descarga (la app no está firmada, así que no se actualiza sola) ----
const REPO='barreirodaniel-debug/odontos-imagen';
const vNum=v=>String(v).replace(/^v/,'').split('.').map(n=>parseInt(n)||0);
const esMayor=(a,b)=>{const x=vNum(a),y=vNum(b);for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return(x[i]||0)>(y[i]||0);}return false;};
async function buscarActualizacion(){
  try{
    const r=await fetch('https://api.github.com/repos/'+REPO+'/releases/latest',{headers:{'Accept':'application/vnd.github+json','User-Agent':'odontOS-Imagen'}});
    if(!r.ok)return{error:r.status===404?'Todavía no hay versiones publicadas':'No se pudo consultar ('+r.status+')',actual:app.getVersion()};
    const j=await r.json(),ver=String(j.tag_name||'').replace(/^v/,'');
    return{actual:app.getVersion(),ultima:ver,nueva:esMayor(ver,app.getVersion()),url:j.html_url,notas:String(j.body||'').slice(0,600)};
  }catch(e){return{error:'Sin conexión',actual:app.getVersion()};}
}
ipcMain.handle('buscarActualizacion',buscarActualizacion);
ipcMain.handle('abrirUrl',(_e,u)=>{if(/^https:\/\/github\.com\//.test(u))shell.openExternal(u);});
module.exports={cargar,abrir,abrirVdc,guardar}; // para pruebas fuera de Electron
