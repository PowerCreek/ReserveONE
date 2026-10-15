import {useEffect,useRef,useState,CSSProperties} from 'react';
import {typed,settle} from '../numinput';
/** Numeric text field you can freely clear/retype (see numinput.ts). Use instead of <input type=number> with an inline validator. */
export function NumInput({value,onChange,min=0,max=1e9,int=true,className='inp',style,label,title}:{value:number;onChange:(n:number)=>void;min?:number;max?:number;int?:boolean;className?:string;style?:CSSProperties;label?:string;title?:string}){
  const [txt,setTxt]=useState(String(value)),foc=useRef(false);
  useEffect(()=>{if(!foc.current)setTxt(String(value))},[value]);
  return <input className={className} style={style} type="text" inputMode={int?'numeric':'decimal'} autoComplete="off" aria-label={label} title={title} value={txt}
    onFocus={e=>{foc.current=true;e.target.select()}}
    onChange={e=>{setTxt(e.target.value);const n=typed(e.target.value,min,max,int);if(n!==null&&n!==value)onChange(n)}}
    onBlur={()=>{foc.current=false;const v=settle(txt,value,min,max,int);setTxt(String(v));if(v!==value)onChange(v)}}
    onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>;
}
