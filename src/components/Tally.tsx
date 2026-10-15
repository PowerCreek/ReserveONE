/** Tally marks for covers: |||| with a strike per 5. */
export function Tally({n}:{n:number}){
  const g=Math.floor(n/5),r=n%5,shown=Math.min(g,8);
  return <span className="tally" title={`${n} covers`}>{Array.from({length:shown},(_,i)=><span key={i} className="tg"><i/><i/><i/><i/><b/></span>)}
    {g>shown&&<small className="muted">+{(g-shown)*5}</small>}{r>0&&<span className="tg">{Array.from({length:r},(_,i)=><i key={i}/>)}</span>}{n===0&&<small className="muted">—</small>}</span>;
}
