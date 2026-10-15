import {App} from './store';
/** Drawer = bottom dock of tabbed widgets. A widget lives either in the drawer or (panels only) the sidebar, never both. */
export const openWidget=(A:App,id:string)=>A.setDrawer({ids:A.drawer.ids.includes(id)?A.drawer.ids:[...A.drawer.ids,id],active:id,open:true});
export const closeWidget=(A:App,id:string)=>{const ids=A.drawer.ids.filter(i=>i!==id);A.setDrawer({ids,active:ids.includes(A.drawer.active)?A.drawer.active:ids[0]??'',open:A.drawer.open})};
