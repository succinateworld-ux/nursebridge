import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

type P = [number, number, number];
const corners: P[] = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const sides = [[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2],[3,2,6,7],[0,1,5,4]];
const blocks = [
  ...[-3.2,3.2].map(x => ({ center:[x,-.4,0] as P, size:[2,.6,2.6] as P, angle:0, order:0 })),
  ...Array.from({length:13},(_,i) => ({ center:[-2.65+i*.44,.02,0] as P, size:[.42,.28,1.8] as P, angle:0, order:i*.045 })),
  ...[-.8,.8].flatMap(z => Array.from({length:15},(_,i) => {
    const a=Math.PI*i/14;
    return { center:[2.55*Math.cos(a),.4+2.55*Math.sin(a),z] as P, size:[.55,.58,.55] as P, angle:a+Math.PI/2, order:.2+i*.045 };
  }))
];

export default function LivingGlacier() {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [reduced,setReduced]=useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [paused,setPaused]=useState(() => { try { return localStorage.getItem("nursebridge-motion")==="off"; } catch { return false; } });
  const moving=!paused&&!reduced;
  useEffect(()=>{document.documentElement.dataset.motion=moving?"on":"off";return()=>{delete document.documentElement.dataset.motion;};},[moving]);
  useEffect(() => {
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const update=() => setReduced(media.matches);
    media.addEventListener("change",update); return () => media.removeEventListener("change",update);
  },[]);
  useEffect(() => {
    const node=canvas.current, ctx=node?.getContext("2d",{alpha:false}), hero=node?.closest<HTMLElement>(".gl-hero");
    if (!node||!ctx||!hero) return;
    let width=1,height=1,frame=0,last=0,time=0,inView=true;
    let targetX=0,targetY=0,px=0,py=0;
    const draw=() => {
      const mobile=width<760, scale=mobile?Math.min(width*.124,62):Math.min(width*.066,height*.126);
      const cx=width*(mobile?.56:.725),cy=height*(mobile?.52:.59);
      const yaw=-.52+Math.sin(time*.17)*.095+px*.3,pitch=.21+py*.06;
      const project=([x,y,z]:P) => {
        const rx=x*Math.cos(yaw)-z*Math.sin(yaw),rz=x*Math.sin(yaw)+z*Math.cos(yaw);
        return {x:cx+rx*scale,y:cy-(y*Math.cos(pitch)-rz*Math.sin(pitch))*scale,depth:rz+y*.04};
      };
      const sky=ctx.createLinearGradient(0,0,0,height);
      sky.addColorStop(0,"#b7c5d2");sky.addColorStop(.58,"#dce6ee");sky.addColorStop(1,"#f2f6f8");
      ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
      for(let layer=0;layer<4;layer++) {
        ctx.beginPath();ctx.moveTo(0,height);
        for(let x=0;x<=width+12;x+=12) ctx.lineTo(x+px*layer*4,height*(.39+layer*.135)+Math.sin(x/width*8+layer*2.4)*height*.045+Math.sin(x/width*22+layer)*height*.014+py*(layer+1)*3);
        ctx.lineTo(width,height);ctx.closePath();ctx.fillStyle=["#b4c4d144","#c8d3de77","#dbe4eb","#e8eef3"][layer];ctx.fill();
      }
      const halo=ctx.createRadialGradient(cx,cy-scale,0,cx,cy-scale,scale*4.8);
      halo.addColorStop(0,"#ffffffcb");halo.addColorStop(.5,"#f3feff55");halo.addColorStop(1,"#ffffff00");ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
      ctx.save();ctx.translate(cx,cy+scale*.7);ctx.scale(1,.12);
      const shadow=ctx.createRadialGradient(0,0,0,0,0,scale*4.6);shadow.addColorStop(0,"#48657944");shadow.addColorStop(1,"#48657900");
      ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,scale*4.6,0,Math.PI*2);ctx.fill();ctx.restore();
      const faces:{points:ReturnType<typeof project>[];depth:number;face:number;shine:number}[]=[];
      blocks.forEach((block,index) => {
        const reveal=moving?Math.min(1,Math.max(0,(time-block.order)/1.25)):1,eased=1-(1-reveal)**3;
        const vertices=corners.map(([u,v,w]) => {
          const x=u*block.size[0]/2,y=v*block.size[1]/2;
          return project([block.center[0]+x*Math.cos(block.angle)-y*Math.sin(block.angle),block.center[1]+x*Math.sin(block.angle)+y*Math.cos(block.angle)+Math.sin(time*.6+index*.16)*.028+(1-eased)*(index%2?2:-1.5),block.center[2]+w*block.size[2]/2+(1-eased)*.6]);
        });
        sides.forEach((side,face) => {const points=side.map(i=>vertices[i]);faces.push({points,depth:points.reduce((sum,p)=>sum+p.depth,0)/4,face,shine:.5+Math.sin(time*.65+index*.19)*.5});});
      });
      faces.sort((a,b)=>b.depth-a.depth).forEach(({points,face,shine}) => {
        const light=face===4?["#ffffff","#c6e6f1"]:face===1?["#e9faff","#7d9eaf"]:["#b8d2df","#688697"];
        const gradient=ctx.createLinearGradient(points[0].x,points[0].y,points[2].x+10,points[2].y+20);
        gradient.addColorStop(0,light[0]);gradient.addColorStop(.52,face===4?"#f4feff":"#c7dfe9");gradient.addColorStop(1,light[1]);
        ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
        ctx.strokeStyle=`rgba(245,255,255,${.55+shine*.4})`;ctx.lineWidth=.8;ctx.stroke();
        if(face===1||face===4){ctx.beginPath();ctx.moveTo(points[0].x+2,points[0].y+2);ctx.lineTo(points[1].x-2,points[1].y+2);ctx.strokeStyle=`rgba(255,255,255,${.4+shine*.5})`;ctx.lineWidth=1.6;ctx.stroke();}
      });
      for(let i=0;i<(mobile?36:78);i++) {
        const speed=.45+i%5*.16,x=((i*137.53+Math.sin(time*.17+i)*9+time*speed*2)%(width+30))-15,y=(i*89.71+time*speed*9)%(height+25)-12;
        ctx.beginPath();ctx.arc(x,y,i%9===0?1.7:.75,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${.25+i%4*.13})`;ctx.fill();
      }
      if(!mobile){ctx.fillStyle="#456171";ctx.font="9px ui-monospace,monospace";ctx.fillText("A BRIDGE TO WHAT'S NEXT",cx+scale*1.2,cy+scale*1.7);}
    };
    const resize=() => {const box=node.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);const dpr=Math.min(devicePixelRatio||1,1.7);node.width=Math.round(width*dpr);node.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();};
    const pointer=(event:PointerEvent) => {if(event.pointerType!=="mouse")return;const box=hero.getBoundingClientRect();targetX=(event.clientX-box.left)/box.width-.5;targetY=(event.clientY-box.top)/box.height-.5;};
    const reset=()=>{targetX=0;targetY=0;};
    const tick=(stamp:number)=>{if(moving&&inView&&!document.hidden&&stamp-last>32){time+=Math.min((stamp-last)/1000,.05);last=stamp;px+=(targetX-px)*.045;py+=(targetY-py)*.045;draw();}else if(document.hidden||!inView)last=stamp;if(moving)frame=requestAnimationFrame(tick);};
    const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(node);
    const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;},{threshold:.01});observer.observe(hero);
    hero.addEventListener("pointermove",pointer,{passive:true});hero.addEventListener("pointerleave",reset);resize();if(moving)frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);sizeObserver.disconnect();observer.disconnect();hero.removeEventListener("pointermove",pointer);hero.removeEventListener("pointerleave",reset);};
  },[moving]);
  return <><div className="gl-scene nb-living-scene" aria-hidden="true"><canvas ref={canvas}/></div><button className="nb-motion-control" aria-pressed={!moving} disabled={reduced} title={reduced?"Your reduced-motion preference is active":undefined} onClick={()=>setPaused(value=>{try{localStorage.setItem("nursebridge-motion",value?"on":"off");}catch{/* Storage is optional. */}return !value;})}>{moving?<Pause size={12}/>:<Play size={12}/>}<span>{reduced?"Reduced motion":moving?"Pause motion":"Play motion"}</span></button></>;
}
