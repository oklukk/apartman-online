export function StaffFeedback({message}:{message:string}) {
 if(!message)return null;
 const failed=/başarısız|uygulanamadı|doğrulanamadı|yenilenemedi|yetki|gerekli|yüklenemedi/i.test(message);
 return <p className={'staff-feedback'+(failed?' staff-error':'')} role={failed?'alert':'status'}>{message}</p>;
}
