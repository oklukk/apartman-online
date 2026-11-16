import { useState } from "react";
import { supabase, errorText } from "../api";
export function StaffMfa() {
  const [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [code, setCode] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function prepare() {
    if (!supabase) return;
    setBusy(true);
    try {
      const r = await supabase.auth.mfa.listFactors();
      if (r.error) throw r.error;
      const existing = r.data.totp.find((f) => f.status === "verified");
      if (existing) {
        setFactor(existing.id);
        setQr("");
      } else {
        const pending = r.data.all.find(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        );
        if (pending) {
          setFactor(pending.id);
          setStatus(
            "Bekleyen MFA kurulumunun uygulamanızdaki kodunu girin. Kurulum kodu kaybolduysa hesabınızın MFA faktörünü güvenli hesap akışından iptal edin.",
          );
          return;
        }
        const e = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "APARTMAN Yönetim",
        });
        if (e.error) throw e.error;
        setFactor(e.data.id);
        setQr(e.data.totp.qr_code);
      }
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (!supabase) return;
    setBusy(true);
    try {
      const r = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (r.error) throw r.error;
      setStatus("MFA doğrulandı. Yönetim işlemlerini kullanabilirsiniz.");
      setCode("");
      setQr("");
      setFactor("");
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="card">
      <h2>Çok faktörlü doğrulama</h2>
      <p>
        Rol, izin ve apartman adı değiştirmek için sunucu AAL2 oturumu ister.
        Doğrulama uygulamanızdaki kodu kullanın.
      </p>
      {status && <p role="status">{status}</p>}
      {!factor ? (
        <button disabled={busy} onClick={() => void prepare()}>
          MFA hazırla / doğrula
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          {qr && (
            <>
              <p>
                QR kodunu kendi doğrulama uygulamanızla tarayın. Bu kodu
                paylaşmayın.
              </p>
              <img
                className="staff-qr"
                src={qr}
                alt="MFA kurulumu için kişisel QR kodu"
              />
            </>
          )}
          <label>
            Altı haneli kod
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              pattern="[0-9]{6}"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
            />
          </label>
          <button disabled={busy}>Oturumu doğrula</button>
        </form>
      )}
    </article>
  );
}
