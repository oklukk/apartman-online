import type {StaffIdentity} from './components/StaffPanel';
/** Presentation gates only. Every write is still checked by the existing server RPC. */
export const staffModules = [
 {key:'genel',label:'Genel Bakış',permissions:[]},
 {key:'oyuncular',label:'Oyuncular ve Denetim',permissions:['players.read','players.profile.edit','players.moderate','players.ban']},
 {key:'ekonomi',label:'Ekonomi',permissions:['economy.read','economy.wallet.adjust','economy.treasury.adjust','economy.settings.manage']},
 {key:'secimler',label:'Seçimler ve Yönetim',permissions:['governance.read','governance.elections.manage','governance.elections.override','governance.manager.appoint']},
 {key:'roller',label:'Roller ve Yetkiler',permissions:['staff.roles.read','world.buildings.read','world.buildings.rename']},
 {key:'gecmis',label:'İşlem Geçmişi ve Telafi',permissions:['staff.audit.read']},
] as const;
export type StaffView = typeof staffModules[number]['key'];
export const isStaffSuper = (identity:StaffIdentity) => identity.roles.some(r=>r.code==='super_admin' && r.scope_kind==='global');
export function staffCan(identity:StaffIdentity,permission:string,building?:string|null):boolean {
 return isStaffSuper(identity) || identity.permissions.includes(permission) || !!(building && identity.scoped_permissions?.some(s=>s.building_id===building && s.permissions.includes(permission)));
}
export function staffHasAny(identity:StaffIdentity,permissions:readonly string[]):boolean {
 return permissions.some(p=>staffCan(identity,p) || identity.scoped_permissions?.some(s=>s.permissions.includes(p)));
}
export function staffModuleVisible(identity:StaffIdentity,view:StaffView):boolean {
 return identity.roles.length>0 && (view==='genel' || staffHasAny(identity,staffModules.find(m=>m.key===view)!.permissions));
}
/** Canonical signature avoids clearing forms for a reordered, unchanged staff_me response. */
export function staffIdentityKey(identity:StaffIdentity):string {
 return JSON.stringify({roles:identity.roles.map(r=>[r.code,r.title,r.scope_kind,r.scope_id]).sort(),permissions:[...identity.permissions].sort(),scopes:(identity.scoped_permissions||[]).map(s=>[s.building_id,[...s.permissions].sort()]).sort()});
}
export function staffFailure(error:unknown,safeRetry=false):string {
 const raw=error && typeof error==='object' && 'message' in error?String(error.message):String(error);
 if (/fetch|network|connection|timeout|bağlantı|ulaşılamadı/i.test(raw)) return 'Sonuç doğrulanamadı. İşlem gerçekleşmiş olabilir; geçmişi kontrol edin.'+(safeRetry?' Aynı bilgilerle yeniden denemek aynı işlem kimliğini kullanır.':' Yeniden göndermeden önce güncel kayıtları inceleyin.');
 return '';
}
