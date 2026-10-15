/** Zoom/pan after a two-finger gesture: keeps the svg point under the initial midpoint (m0) under the current midpoint (f = fraction of the svg box). W,H = viewBox size at zoom 1. */
export function pinchView(z0:number,d0:number,d:number,m0:{x:number;y:number},f:{x:number;y:number},W:number,H:number){
  const zoom=Math.min(2.5,Math.max(.4,z0*d/d0));return{zoom,pan:{x:m0.x-f.x*W/zoom,y:m0.y-f.y*H/zoom}};
}
