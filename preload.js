const {contextBridge,ipcRenderer}=require('electron');
const inv=c=>(...a)=>ipcRenderer.invoke(c,...a);
contextBridge.exposeInMainWorld('api',{
  abrir:inv('abrir'),abrirVdc:inv('abrirVdc'),guardar:inv('guardar'),informe:inv('informe'),png:inv('png'),buscarActualizacion:inv('buscarActualizacion'),abrirUrl:inv('abrirUrl'),stl:inv('stl'),
  recientes:inv('recientes'),cfgLeer:inv('cfgLeer'),cfgGuardar:inv('cfgGuardar'),imagen:inv('imagen'),inicial:inv('inicial'),sucio:v=>ipcRenderer.send('sucio',v),
  onMenu:f=>ipcRenderer.on('menu',(_e,a)=>f(a)),onAbrirVdc:f=>ipcRenderer.on('abrir-vdc',(_e,p)=>f(p))
});
