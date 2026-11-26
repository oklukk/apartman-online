import {useEffect,useRef,useState,type ReactNode} from 'react';
export type StaffReview = {title:string;summary:string;details:Record<string,string>};
export function StaffConfirmation({review,busy=false,message,onConfirm,onCancel}: {review:StaffReview;busy?:boolean;message?:string;onConfirm:()=>void;onCancel:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const opener=document.activeElement as HTMLElement|null;
  const element=dialog.current;element?.showModal();element?.querySelector<HTMLElement>('#staff-review-title')?.focus({preventScroll:true});if(element)element.scrollTop=0;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  return ()=>{element?.close();document.body.style.overflow=previous;if(opener?.isConnected && opener.getClientRects().length)opener.focus({preventScroll:true});else document.querySelector<HTMLElement>('main h1')?.focus({preventScroll:true});};
 },[]);
 return <dialog ref={dialog} className="staff-review" aria-labelledby="staff-review-title" onCancel={e=>{e.preventDefault();if(!busy)onCancel();}} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(n=>n.getClientRects().length);
  if(!nodes.length){e.preventDefault();return;}e.preventDefault();const index=nodes.indexOf(document.activeElement as HTMLButtonElement);nodes[index<0?(e.shiftKey?nodes.length-1:0):(index+(e.shiftKey?nodes.length-1:1))%nodes.length].focus();
 }}>
  <div className="eyebrow">ÖNİZLEME · SON ONAY</div><h2 id="staff-review-title" tabIndex={-1}>{review.title}</h2><p>{review.summary}</p>
  <dl>{Object.entries(review.details).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value || '—'}</dd></div>)}</dl>
  <p className="footnote">İşlem sunucuda yetki ve iki aşamalı doğrulama kontrolünden geçer. Onay, sunucu işlemi başarılı sonuçlanana kadar başarı anlamına gelmez.</p>
  {message && <p role="status">{message}</p>}
  <div className="staff-review-actions"><button type="button" className="secondary staff-cancel" disabled={busy} onClick={onCancel}>Vazgeç</button><button type="button" disabled={busy} onClick={onConfirm}>{busy?'Sunucu yanıtı bekleniyor…':'Onayla ve uygula'}</button></div>
 </dialog>;
}
export function useStaffConfirmation(resetKey?:string):{ask:(review:StaffReview)=>Promise<boolean>;dialog:ReactNode} {
 const [review,setReview]=useState<StaffReview|null>(null);
 const resolver=useRef<((result:boolean)=>void)|null>(null);
 useEffect(()=>()=>{resolver.current?.(false);resolver.current=null;},[]);
 useEffect(()=>{resolver.current?.(false);resolver.current=null;setReview(null);},[resetKey]);
 const finish=(result:boolean)=>{const resolve=resolver.current;resolver.current=null;setReview(null);resolve?.(result);};
 return {ask:(next)=>{if(resolver.current)return Promise.resolve(false);setReview(next);return new Promise(resolve=>{resolver.current=resolve;});},dialog:review?<StaffConfirmation review={review} onConfirm={()=>finish(true)} onCancel={()=>finish(false)}/>:null};
}
