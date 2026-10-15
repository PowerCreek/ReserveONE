/** Simulation clock: shifts Date.now() and new Date() by an offset (0 = real time). Installed once; lets the whole app time-travel with no per-call changes. */
const R=Date;let off=0;
(globalThis as any).Date=new Proxy(R,{construct:(t,a)=>a.length?Reflect.construct(t,a):new t(R.now()+off),get:(t,k,r)=>k==='now'?()=>R.now()+off:Reflect.get(t,k,r)});
export const getOffset=()=>off;
export const setOffset=(ms:number)=>{off=ms};
