import {useApp} from '../state/store';
import {LocatorWidget} from './Locator';
import {Help} from './Help';
/** Simulation status. Collapses to the 🧪 icon (remembered) so it never covers the table locator below it. */
export function SimBar(){
  const A=useApp();if(!A.sim)return null;
  const c=!!A.ui.simbar?.c,set=(v:boolean)=>A.setUi({...A.ui,simbar:{...(A.ui.simbar||{}),c:v}}),clock=A.simOffset?`+${Math.round(A.simOffset/60000)} min`:'live';
  if(c)return <button className="simdot" title={`Simulation ON · clock ${clock} (tap to expand)`} aria-label="Expand simulation status" onClick={()=>set(false)}>🧪</button>;
  return <div className="simbar"><b>🧪 SIMULATION</b><span className="rchip warn">clock {clock}</span><Help id="simbar"/>
    <button className="btn sm" onClick={()=>A.exitSim(false)}>Exit &amp; discard</button><button className="pbtn" title="Collapse to icon" aria-label="Collapse simulation status" onClick={()=>set(true)}>▴</button></div>;
}
/** One fixed parent (top right) stacking the simulation status and the table locator, so they can never overlap. */
export function FixedTop(){return <div className="fixtop"><SimBar/><LocatorWidget/></div>}
