import { useState } from "react";
import { supabase, errorText } from "../api";

type Mode = "new" | "pending" | "verified" | null;

export function StaffMfa() {
  const [factor, setFactor] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function enrollNew() {
    if (!supabase) return;
    const enrolled = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "APARTMAN Yönetim",
    });
    if (enrolled.error) throw enrolled.error;
    setFactor(enrolled.data.id);
    setMode("new");
    setQr(enrolled.data.totp.qr_code);
    setCode("");
    setStatus("QR kodunu doğrulama uygulamanızla tarayın ve üretilen altı haneli kodu girin.");
  }

  async function prepare() {
    if (!supabase || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await supabase.auth.mfa.listFactors();
      if (result.error) throw result.error;
      const verified = result.data.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactor(verified.id);
        setMode("verified");
        setQr("");
        setStatus("Bu hesapta MFA zaten kurulu. Doğrulama uygulamanızdaki altı haneli kodu girin.");
        return;
      }
      const pending = result.data.all.find(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      );
      if (pending) {
        setFactor(pending.id);
        setMode("pending");
        setQr("");
        setStatus(
          "Önceki MFA kurulumu tamamlanmamış. QR kodunu daha önce taradıysanız kodu girebilirsiniz. Taramadıysanız aşağıdaki düğmeyle yeni QR oluşturun.",
        );
        return;
      }
      await enrollNew();
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function restartPending() {
    if (!supabase || !factor || mode !== "pending" || busy) return;
    setBusy(true);
    setStatus("");
    try {
      // Refresh from Auth: never delete a factor that has become verified.
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const pending = factors.data.all.find(
        (f) => f.id === factor && f.factor_type === "totp" && f.status === "unverified",
      );
      if (!pending) {
        setFactor("");
        setMode(null);
        setQr("");
        setStatus("Kurulum durumu değişmiş. MFA hazırla / doğrula düğmesiyle tekrar kontrol edin.");
        return;
      }
      const removed = await supabase.auth.mfa.unenroll({ factorId: pending.id });
      if (removed.error) throw removed.error;
      setFactor("");
      setMode(null);
      setQr("");
      await enrollNew();
    } catch (e) {
      setStatus("Kurulum yenilenemedi: " + errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!supabase || !factor || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code: code.trim(),
      });
      if (result.error) throw result.error;
      setStatus("MFA doğrulandı. Yönetici yetkiniz varsa yönetim işlemlerini kullanabilirsiniz.");
      setCode("");
      setQr("");
      setFactor("");
      setMode(null);
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
        MFA kurulumu tek başına yönetici yetkisi vermez.
      </p>
      {status && <p role="status">{status}</p>}
      {!factor ? (
        <button disabled={busy} onClick={() => void prepare()}>
          MFA hazırla / doğrula
        </button>
      ) : (
        <>
          {qr && (
            <>
              <p>QR kodunu kendi doğrulama uygulamanızla tarayın. Bu kodu paylaşmayın.</p>
              <img
                className="staff-qr"
                src={qr}
                alt="MFA kurulumu için kişisel QR kodu"
              />
            </>
          )}
          <form onSubmit={(e) => { e.preventDefault(); void verify(); }}>
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
          {mode === "pending" && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void restartPending()}
            >
              Yarım kalan kurulumu iptal et ve yeni QR oluştur
            </button>
          )}
        </>
      )}
    </article>
  );
}
