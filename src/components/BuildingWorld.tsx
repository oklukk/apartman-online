import { useState, type MouseEvent } from 'react';
import { anchors } from 'virtual:apartman-art-catalog';
import { routeHref } from '../navigation';
import type { PublicApartment, ResidentPublicInfo } from '../social';
import { Avatar } from './Avatar';
export const entryAnchor = {x:425,y:860,width:150,height:120}; // Separate door hitbox; no dwelling number.
export const doorNumber = (n: number) => String(n).padStart(2,'0');
export function ResidentBadges({ resident, viewerId }: { resident?: ResidentPublicInfo; viewerId: string }) {
  return <span className="resident-badges">{resident?.userId === viewerId && <span className="state-pill">Senin dairen</span>}{resident?.isManager && <span className="state-pill manager-badge">Apartman yöneticisi</span>}</span>;
}
const statusText = (unit: PublicApartment) => unit.resident?.username || (unit.status === 'empty' ? 'Boş daire' : 'Bilgiye erişilemiyor');
export function BuildingWorld({ units, viewerId, target, onResident }: {
  units: PublicApartment[]; viewerId: string; target?: string; onResident: (resident: ResidentPublicInfo, trigger: HTMLElement) => void;
}) {
  const [selected, setSelected] = useState<{number:number;target?:string}>();
  const [failed, setFailed] = useState(false);
  const targetNumber = target?.startsWith('daire-') ? Number(target.slice(6)) : undefined;
  const chosen = units.find(a => a.number === (selected?.target === target ? selected?.number || targetNumber : targetNumber));
  const select = (unit: PublicApartment, event: MouseEvent<HTMLButtonElement>) => {
    setSelected({number:unit.number,target});
    if (unit.resident) onResident(unit.resident,event.currentTarget);
  };
  const style = (a: {x:number;y:number;width:number;height:number}) => ({left:a.x/anchors.viewBox[2]*100+'%',top:a.y/anchors.viewBox[3]*100+'%',width:a.width/anchors.viewBox[2]*100+'%',height:a.height/anchors.viewBox[3]*100+'%'});
  return <div className="interactive-world">
    <p className="footnote" id="building-instructions">Dairelere dokunarak komşularını tanı. Dar ekranda binayı yana kaydırabilirsin; aşağıdaki daire listesi de aynı işlemleri açar.</p>
    <div className="facade-scroll" role="region" aria-label="Etkileşimli apartman" tabIndex={0} aria-describedby="building-instructions">
      <div className="facade-map">
        {!failed ? <img src={import.meta.env.BASE_URL+'art/v2/apartment-facade.svg'} width={1000} height={1100} alt="Dört konut katında üçer daire, ayrı giriş ve ortak bahçeli apartman" onError={() => setFailed(true)}/> : <p className="facade-unavailable">Bina görseli yüklenemedi. Daire listesi aşağıda kullanılabilir.</p>}
        {anchors.apartments.map(a => {
          const unit = units.find(u => u.number === a.number);
          if (!unit) return null;
          return <button type="button" className={'facade-door'+(unit.resident?.userId === viewerId ? ' own-door' : '')} style={style(a)} id={'daire-'+doorNumber(a.number)} key={a.number} aria-label={'Daire '+doorNumber(a.number)+' · '+a.floor+'. kat · '+statusText(unit)+(unit.resident?.userId === viewerId ? ' · Senin dairen' : '')+(unit.resident?.isManager ? ' · Apartman yöneticisi' : '')} onClick={e => select(unit,e)} aria-pressed={chosen?.number === a.number}>
            <span className="map-number">{doorNumber(a.number)}<span className="map-state" aria-hidden="true">{unit.status === 'empty' ? 'Boş' : unit.status === 'occupied' ? 'Dolu' : '—'}</span></span>
            <span className="map-badges" aria-hidden="true">{unit.resident?.userId === viewerId && <span>Sen</span>}{unit.resident?.isManager && <span>Yön.</span>}</span>
          </button>;
        })}
        <a className="facade-entry" style={style(entryAnchor)} href={routeHref({page:'building',section:'kasa-pano'})} aria-label="Apartman girişi · Kasa ve Pano"><span>Giriş</span></a>
      </div>
    </div>
    <p className="footnote">Pencere ve balkon süsleri çevrim içi durum göstermez. Sen: kendi dairen · Yön.: görevdeki apartman yöneticisi.</p>
    {chosen && <div className="apartment-info" role="status"><strong>Daire {doorNumber(chosen.number)}</strong><p>{statusText(chosen)}</p>{chosen.resident && <><ResidentBadges resident={chosen.resident} viewerId={viewerId}/><button type="button" className="secondary" onClick={e => onResident(chosen.resident!,e.currentTarget)}>Komşu kartını aç</button></>}</div>}
    <h3>Daire listesi</h3>
    <ul className="apartment-alternatives" aria-label="Bütün daireler">{units.map(unit => <li key={unit.number}><button type="button" className="secondary" onClick={e => select(unit,e)}><strong>Daire {doorNumber(unit.number)}</strong><span>{Math.ceil(unit.number/3)}. kat · {statusText(unit)}</span><ResidentBadges resident={unit.resident} viewerId={viewerId}/></button></li>)}</ul>
  </div>;
}
export function ResidentDirectory({ units, viewerId, busy, blockedIds, onResident, onBlock }: {
  units: PublicApartment[]; viewerId: string; busy: boolean; blockedIds: string[];
  onResident: (resident: ResidentPublicInfo, trigger: HTMLElement) => void; onBlock: (id: string) => void;
}) {
  return <ul className="resident-list social-directory">{units.map(unit => <li key={unit.number}>
    {unit.resident ? <><button type="button" className="resident-open" onClick={e => onResident(unit.resident!,e.currentTarget)}>
      <Avatar userId={unit.resident.userId} name={unit.resident.username} size={52}/><span><strong>{unit.resident.username}</strong><small>Daire {doorNumber(unit.number)} · {unit.resident.floor}. kat</small></span><ResidentBadges resident={unit.resident} viewerId={viewerId}/>
    </button>{unit.resident.userId !== viewerId && <button type="button" className="text-button" disabled={busy} onClick={() => onBlock(unit.resident!.userId)}>{blockedIds.includes(unit.resident.userId) ? 'Engeli kaldır' : 'Mesajları gizle'}</button>}</> : <><span className="door-number">{doorNumber(unit.number)}</span><span>{statusText(unit)}</span></>}
  </li>)}</ul>;
}
