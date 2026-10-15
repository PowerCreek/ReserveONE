/** Free-typing numeric fields. While typing: empty/partial text is allowed and only IN-RANGE numbers are committed (so "1" can be the start of "15" even when min is 10).
 *  On blur/Enter: empty or invalid text restores the previous value; out-of-range numbers are clamped. */
export const typed=(s:string,min:number,max:number,int=true):number|null=>{const t=s.trim();if(t==='')return null;const n=Number(t);if(!Number.isFinite(n))return null;const v=int?Math.round(n):n;return v>=min&&v<=max?v:null};
export const settle=(s:string,prev:number,min:number,max:number,int=true):number=>{const t=s.trim(),n=Number(t);if(t===''||!Number.isFinite(n))return prev;const v=int?Math.round(n):n;return Math.min(max,Math.max(min,v))};
