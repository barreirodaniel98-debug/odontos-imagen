"""Dibuja 3 propuestas de ícono (1024 px, forma macOS) para odontOS Imagen. Uso: python hacer_iconos.py"""
import os, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops
OUT=os.path.dirname(os.path.abspath(__file__)); LOGO=os.path.expanduser("~/Documents/GitHub/fichas-dentales/logo-os-dark.png")
SS=2; N=1024*SS; BODY=824*SS; OFF=(N-BODY)//2; R=int(BODY*0.2237)
AZUL=(2,132,199); CIAN=(56,189,248); VERDE=(74,255,154); AMARILLO=(255,225,74)
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
def degradado(c1,c2,w=BODY,h=BODY,diag=True):
    g=Image.new("RGB",(w,h)); px=g.load()
    for y in range(h):
        for x in range(w): px[x,y]=lerp(c1,c2,((x+y)/(w+h)) if diag else y/h)
    return g
def squircle(fondo):
    m=Image.new("L",(BODY,BODY),0); ImageDraw.Draw(m).rounded_rectangle((0,0,BODY-1,BODY-1),R,fill=255)
    base=Image.new("RGBA",(N,N),(0,0,0,0))
    sh=Image.new("RGBA",(N,N),(0,0,0,0)); sm=Image.new("L",(N,N),0); sm.paste(m,(OFF,OFF+14*SS))
    sh.putalpha(sm.filter(ImageFilter.GaussianBlur(22*SS)).point(lambda v:int(v*0.45))); base=Image.alpha_composite(base,sh)
    cuerpo=fondo.convert("RGBA"); cuerpo.putalpha(m); base.alpha_composite(cuerpo,(OFF,OFF)); return base,m
def diente(img,cx,cy,ang,w,h,col,corona=0.5):
    # diente = rectángulo redondeado girado; corona más ancha arriba
    t=Image.new("RGBA",(w*2,h*2),(0,0,0,0)); d=ImageDraw.Draw(t)
    d.rounded_rectangle((w//2,h//2,w//2+w,h//2+h),int(w*corona),fill=col)
    t=t.rotate(-ang,resample=Image.BICUBIC,expand=True); img.alpha_composite(t,(int(cx-t.width/2),int(cy-t.height/2)))
def final(base,nombre):
    im=base.resize((1024,1024),Image.LANCZOS); im.save(f"{OUT}/{nombre}.png"); return im

# ---- A: marca OS (logo real sobre azul noche) ----
fondo=degradado((12,26,46),(6,13,26)); base,m=squircle(fondo)
logo=Image.open(LOGO).convert("RGBA"); k=BODY*0.66/logo.width; logo=logo.resize((int(logo.width*k),int(logo.height*k)),Image.LANCZOS)
base.alpha_composite(logo,(N//2-logo.width//2,N//2-logo.height//2)); A=final(base,"A_marca_OS")

# ---- B: diente con marco de escaneo sobre azul de la marca ----
fondo=degradado((14,165,233),(2,100,160)); base,m=squircle(fondo); d=ImageDraw.Draw(base)
cx,cy=N//2,N//2
mk=Image.new("L",(N,N),0); md=ImageDraw.Draw(mk); u=BODY/100
def P(x,y): return (cx+(x-50)*u, cy+(y-50)*u)
md.rounded_rectangle((*P(28,17),*P(72,58)),int(19*u),fill=255)                      # corona
md.polygon([P(31,48),P(47,48),P(40.5,88),P(37,88)],fill=255)   # raíz izq
md.polygon([P(53,48),P(69,48),P(63,88),P(59.5,88)],fill=255)   # raíz der
mk=mk.filter(ImageFilter.GaussianBlur(9*SS)).point(lambda v:255 if v>128 else 0).filter(ImageFilter.GaussianBlur(1.2*SS))
blanco=Image.new("RGBA",(N,N),(255,255,255,255)); base.paste(blanco,(0,0),mk)
brillo=Image.new("L",(N,N),0); ImageDraw.Draw(brillo).rounded_rectangle((*P(35,23),*P(43,40)),int(3*u),fill=255)
base.paste(Image.new("RGBA",(N,N),(186,230,253,255)),(0,0),brillo)
w=int(BODY*0.020); l=BODY*0.14; ox=BODY*0.34; oy=BODY*0.34
for sx in (-1,1):
    for sy in (-1,1):
        x,y=cx+sx*ox,cy+sy*oy
        d.line((x,y,x-sx*l,y),fill=VERDE+(255,),width=w); d.line((x,y,x,y-sy*l),fill=VERDE+(255,),width=w)
        d.ellipse((x-w/2,y-w/2,x+w/2,y+w/2),fill=VERDE+(255,))
B=final(base,"B_diente_escaneo")

# ---- C: corte axial + cruz + regla (como la pantalla de la app) ----
fondo=degradado((26,29,36),(10,12,16)); base,m=squircle(fondo); d=ImageDraw.Draw(base)
cx,cy=N//2,int(N*0.50); rx,ry=BODY*0.265,BODY*0.30; n=14
P=[]
for i in range(n):
    a=math.radians(188-196*i/(n-1)); P.append((a,cx+rx*math.cos(a),cy-ry*math.sin(a)+BODY*0.02))
for i,(a,x,y) in enumerate(P):
    vec=[math.hypot(x-P[j][1],y-P[j][2]) for j in (i-1,i+1) if 0<=j<n]; w=int(0.92*sum(vec)/len(vec)); hh=int(w*1.22)
    t=abs(i-(n-1)/2)/((n-1)/2); w=int(w*(1-0.10*t)); hh=int(hh*(1-0.12*t))
    diente(base,x,y,90-math.degrees(a),w,hh,(236,240,245,255),0.40)
lw=int(BODY*0.008)
d.line((cx,OFF+BODY*0.10,cx,OFF+BODY*0.90),fill=AMARILLO+(150,),width=lw); d.line((OFF+BODY*0.10,cy+BODY*0.04,OFF+BODY*0.90,cy+BODY*0.04),fill=AMARILLO+(150,),width=lw)
ya=int(OFF+BODY*0.80); xa,xb=int(cx-BODY*0.20),int(cx+BODY*0.20)
d.line((xa,ya,xb,ya),fill=AMARILLO+(255,),width=int(BODY*0.016))
for xx in (xa,xb): d.line((xx,ya-BODY*0.03,xx,ya+BODY*0.03),fill=AMARILLO+(255,),width=int(BODY*0.016))
for j in range(1,8): xx=xa+(xb-xa)*j/8; d.line((xx,ya,xx,ya-BODY*(0.022 if j%2 else 0.03)),fill=AMARILLO+(255,),width=int(BODY*0.008))
C=final(base,"C_corte_regla")
print("ok")

# ================= Variantes de la C con más personalidad =================
def arco(cx=N//2,cy=int(N*0.50),n=14):
    rx,ry=BODY*0.265,BODY*0.30;P=[]
    for i in range(n):
        a=math.radians(188-196*i/(n-1));P.append((a,cx+rx*math.cos(a),cy-ry*math.sin(a)+BODY*0.02))
    out=[]
    for i,(a,x,y) in enumerate(P):
        vec=[math.hypot(x-P[j][1],y-P[j][2]) for j in (i-1,i+1) if 0<=j<n];w=int(0.92*sum(vec)/len(vec));hh=int(w*1.22)
        t=abs(i-(n-1)/2)/((n-1)/2);out.append((x,y,math.degrees(a),int(w*(1-0.10*t)),int(hh*(1-0.12*t))))
    return out
def mascara(lista):
    m=Image.new("L",(N,N),0)
    for x,y,a,w,h in lista:
        t=Image.new("L",(w*2,h*2),0);ImageDraw.Draw(t).rounded_rectangle((w//2,h//2,w//2+w,h//2+h),int(w*0.40),fill=255)
        t=t.rotate(-(90-a),resample=Image.BICUBIC,expand=True);m.paste(255,(int(x-t.width/2),int(y-t.height/2)),t)
    return m
def vgrad(c1,c2):
    g=Image.new("RGBA",(N,N));px=g.load()
    for y in range(N):
        c=lerp(c1,c2,y/N)+(255,)
        for x in range(N):px[x,y]=c
    return g
def brillo_radial(cx,cy,r,col,alfa):
    g=Image.new("L",(N,N),0);ImageDraw.Draw(g).ellipse((cx-r,cy-r,cx+r,cy+r),fill=alfa);g=g.filter(ImageFilter.GaussianBlur(r*0.45))
    return Image.merge("RGBA",(Image.new("L",(N,N),col[0]),Image.new("L",(N,N),col[1]),Image.new("L",(N,N),col[2]),g))
def regla_y_cruz(base,d,cx,cy,col_cruz,alfa=150,centro=False):
    ov=Image.new("RGBA",(N,N),(0,0,0,0));d=ImageDraw.Draw(ov)
    lw=int(BODY*0.008)
    d.line((cx,OFF+BODY*0.10,cx,OFF+BODY*0.90),fill=col_cruz+(alfa,),width=lw);d.line((OFF+BODY*0.10,cy+BODY*0.04,OFF+BODY*0.90,cy+BODY*0.04),fill=col_cruz+(alfa,),width=lw)
    if centro:
        r=BODY*0.028;d.ellipse((cx-r,cy+BODY*0.04-r,cx+r,cy+BODY*0.04+r),outline=col_cruz+(255,),width=int(BODY*0.008))
    ya=int(OFF+BODY*0.80);xa,xb=int(cx-BODY*0.20),int(cx+BODY*0.20)
    d.line((xa,ya,xb,ya),fill=AMARILLO+(255,),width=int(BODY*0.016))
    for xx in (xa,xb):d.line((xx,ya-BODY*0.03,xx,ya+BODY*0.03),fill=AMARILLO+(255,),width=int(BODY*0.016))
    for j in range(1,8):xx=xa+(xb-xa)*j/8;d.line((xx,ya,xx,ya-BODY*(0.022 if j%2 else 0.03)),fill=AMARILLO+(255,),width=int(BODY*0.008))
    base.alpha_composite(ov)
cx,cy=N//2,int(N*0.50);dientes=arco();M=mascara(dientes)

# C1 · Radar: halo de hueso + anillos de escáner + dientes con volumen
base,m=squircle(degradado((26,29,36),(8,10,14)));base.alpha_composite(brillo_radial(cx,cy+int(BODY*0.02),int(BODY*0.36),CIAN,95))
ov=Image.new("RGBA",(N,N),(0,0,0,0));d=ImageDraw.Draw(ov)
for r in (0.13,0.22,0.31,0.40):
    rr=BODY*r;d.ellipse((cx-rr,cy+BODY*0.04-rr,cx+rr,cy+BODY*0.04+rr),outline=(255,255,255,26),width=int(BODY*0.004))
for ang in range(0,360,30):
    a=math.radians(ang);d.line((cx+BODY*0.05*math.cos(a),cy+BODY*0.04+BODY*0.05*math.sin(a),cx+BODY*0.40*math.cos(a),cy+BODY*0.04+BODY*0.40*math.sin(a)),fill=(255,255,255,14),width=int(BODY*0.003))
base.alpha_composite(ov)
halo=Image.new("RGBA",(N,N),CIAN+(255,));base.paste(halo,(0,0),M.filter(ImageFilter.GaussianBlur(16*SS)).point(lambda v:int(v*0.55)))
base.paste(vgrad((255,255,255),(176,196,216)),(0,0),M)
d=ImageDraw.Draw(base);regla_y_cruz(base,d,cx,cy,AMARILLO,150,centro=True);final(base,"C1_radar")

# C2 · Circuito: dientes de línea fina y nodos, como el logo OS
base,m=squircle(degradado((12,26,46),(5,11,22)));base.alpha_composite(brillo_radial(cx,cy,int(BODY*0.30),AZUL,110))
k=5*SS;er=M.filter(ImageFilter.MinFilter(2*k+1));borde=ImageChops.subtract(M,er)
base.paste(Image.new("RGBA",(N,N),CIAN+(255,)),(0,0),er.point(lambda v:int(v*0.16)));base.paste(Image.new("RGBA",(N,N),CIAN+(255,)),(0,0),borde)
d=ImageDraw.Draw(base)
for i in (1,3,5,8,10,12):
    x,y,a,w,h=dientes[i];ar=math.radians(a);ux,uy=math.cos(ar),-math.sin(ar)
    x1,y1=x+ux*h*0.62,y+uy*h*0.62;x2,y2=x+ux*(h*0.62+BODY*0.065),y+uy*(h*0.62+BODY*0.065)
    d.line((x1,y1,x2,y2),fill=CIAN+(255,),width=int(BODY*0.006));r=BODY*0.012;d.ellipse((x2-r,y2-r,x2+r,y2+r),outline=CIAN+(255,),width=int(BODY*0.006))
regla_y_cruz(base,d,cx,cy,CIAN,110);final(base,"C2_circuito")

# C3 · Escáner: barrido luminoso que va revelando la arcada
base,m=squircle(degradado((24,27,34),(9,11,15)));ov=Image.new("RGBA",(N,N),(0,0,0,0));d=ImageDraw.Draw(ov)
for y in range(int(OFF+BODY*0.1),int(OFF+BODY*0.9),int(BODY*0.018)):d.line((OFF+BODY*0.08,y,OFF+BODY*0.92,y),fill=(255,255,255,9),width=2)
base.alpha_composite(ov)
yb=int(cy-BODY*0.01)
base.paste(vgrad((70,78,92),(70,78,92)),(0,0),M)
arriba=Image.new("L",(N,N),0);ImageDraw.Draw(arriba).rectangle((0,0,N,yb),fill=255)
base.paste(vgrad((255,255,255),(214,228,240)),(0,0),ImageChops.multiply(M,arriba))
banda=Image.new("L",(N,N),0);ImageDraw.Draw(banda).rectangle((OFF+BODY*0.08,yb-BODY*0.05,OFF+BODY*0.92,yb+BODY*0.05),fill=150)
base.paste(Image.new("RGBA",(N,N),CIAN+(255,)),(0,0),banda.filter(ImageFilter.GaussianBlur(BODY*0.03)))
d=ImageDraw.Draw(base);d.line((OFF+BODY*0.08,yb,OFF+BODY*0.92,yb),fill=CIAN+(255,),width=int(BODY*0.010))
for xx in (OFF+BODY*0.08,OFF+BODY*0.92):r=BODY*0.016;d.ellipse((xx-r,yb-r,xx+r,yb+r),fill=CIAN+(255,))
ya=int(OFF+BODY*0.80);xa,xb=int(cx-BODY*0.20),int(cx+BODY*0.20)
d.line((xa,ya,xb,ya),fill=AMARILLO+(255,),width=int(BODY*0.016))
for xx in (xa,xb):d.line((xx,ya-BODY*0.03,xx,ya+BODY*0.03),fill=AMARILLO+(255,),width=int(BODY*0.016))
for j in range(1,8):xx=xa+(xb-xa)*j/8;d.line((xx,ya,xx,ya-BODY*(0.022 if j%2 else 0.03)),fill=AMARILLO+(255,),width=int(BODY*0.008))
final(base,"C3_escaner");print("variantes ok")
