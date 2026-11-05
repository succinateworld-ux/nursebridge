import { useEffect } from "react";

export default function MotionExperience() {
  useEffect(() => {
    const root=document.querySelector<HTMLElement>(".gl-theme");
    if(!root)return;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen=new WeakSet<Element>();
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("nb-is-visible");observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:"0px 0px -24px 0px"});
    const discover=()=>root.querySelectorAll<HTMLElement>(".gl-section-head,.gl-cockpit > article,.gl-pathway-row,.gl-featured-lesson,.gl-method li,.gl-open-door > h2").forEach((element,index)=>{
      if(seen.has(element))return;seen.add(element);
      if(reduced.matches)return;
      element.classList.add("nb-enter");element.style.setProperty("--enter-delay",`${Math.min(index%3,2)*70}ms`);observer.observe(element);
    });
    const update=()=>{const total=document.documentElement.scrollHeight-innerHeight;document.documentElement.style.setProperty("--reading-progress",`${total>0?Math.min(100,scrollY/total*100):0}%`);};
    const mutation=new MutationObserver(discover);mutation.observe(root,{childList:true,subtree:true});discover();
    const preference=()=>{if(reduced.matches)root.querySelectorAll(".nb-enter").forEach(element=>element.classList.add("nb-is-visible"));};
    reduced.addEventListener("change",preference);window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);update();
    return()=>{observer.disconnect();mutation.disconnect();reduced.removeEventListener("change",preference);window.removeEventListener("scroll",update);window.removeEventListener("resize",update);};
  },[]);
  return <div className="nb-reading-progress" aria-hidden="true"/>;
}
