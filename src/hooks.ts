import {useRef} from 'react';
/** Custom single/double tap detector (spec §4: same key within 380ms). */
export function useTap(){
  const last=useRef({k:'',t:0});
  return (key:string,single:()=>void,dbl:()=>void)=>()=>{
    const n=Date.now();
    if(last.current.k===key&&n-last.current.t<380){last.current={k:'',t:0};dbl()}else{last.current={k:key,t:n};single()}
  };
}
