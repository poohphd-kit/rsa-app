import React, { useMemo, useState } from "react";

const PRIMES = [31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const E_CANDIDATES = [3, 5, 7, 11, 13, 17];
const MAX_LENGTH = 20;

type KeyState = {
  p: number;
  q: number;
  n: number;
  phi: number;
  e: number;
  d: number;
};

type EncRow = {
  char: string;
  m: number;
  mPrime: number;
  c: number;
};

type DecryptRow = {
  c: number;
  mPrime: number;
  m: number;
  char: string;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x;
}

function egcd(a: number, b: number): { g: number; x: number; y: number } {
  if (b === 0) return { g: a, x: 1, y: 0 };
  const result = egcd(b, a % b);
  return {
    g: result.g,
    x: result.y,
    y: result.x - Math.floor(a / b) * result.y,
  };
}

function modInverse(e: number, phi: number): number {
  const result = egcd(e, phi);
  if (result.g !== 1) throw new Error("逆元が存在しません。");
  return ((result.x % phi) + phi) % phi;
}

function modPow(base: number, exp: number, mod: number): number {
  let result = 1;
  let b = base % mod;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) result = (result * b) % mod;
    b = (b * b) % mod;
    e = Math.floor(e / 2);
  }
  return result;
}

function pickRandomPrimePair(): [number, number] {
  const p = PRIMES[Math.floor(Math.random() * PRIMES.length)];
  let q = p;
  while (q === p) q = PRIMES[Math.floor(Math.random() * PRIMES.length)];
  return [p, q];
}

function generateKeys(): KeyState {
  const [p, q] = pickRandomPrimePair();
  const n = p * q;
  const phi = (p - 1) * (q - 1);
  const e = E_CANDIDATES.find((candidate) => gcd(candidate, phi) === 1);
  if (e === undefined) throw new Error("条件を満たす e が見つかりません。");
  const d = modInverse(e, phi);
  return { p, q, n, phi, e, d };
}

function charToNumber(char: string): number {
  return char.charCodeAt(0) - 64;
}

function numberToChar(num: number): string {
  if (num < 1 || num > 26) return "?";
  return String.fromCharCode(num + 64);
}

function pickRandomK(m: number, n: number): number {
  const maxK = Math.floor((n - 1 - m) / 26);
  if (maxK <= 0) return 0;
  return Math.floor(Math.random() * (maxK + 1));
}

function validateMessage(text: string): string | null {
  if (text.length === 0) return "暗号化する文章を入力してください。";
  if (text.length > MAX_LENGTH) return "20文字以内で入力してください。";
  if (!/^[A-Z]+$/.test(text)) return "使用できる文字は A〜Z のみです。";
  return null;
}

function parsePositiveInteger(value: string, label: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(label + " は正の整数で入力してください。");
  }
  return num;
}

export default function RSAExperienceApp() {
  const [activeTab, setActiveTab] = useState<"keys" | "encrypt" | "decrypt">("keys");
  const [keys, setKeys] = useState<KeyState | null>(null);
  const [message, setMessage] = useState("SOSUUDAISUKI");
  const [encodingMode, setEncodingMode] = useState<"simple" | "randomized">("randomized");
  const [publicE, setPublicE] = useState("");
  const [publicN, setPublicN] = useState("");
  const [rows, setRows] = useState<EncRow[]>([]);
  const [receivedCipher, setReceivedCipher] = useState("");
  const [receivedRows, setReceivedRows] = useState<DecryptRow[]>([]);
  const [error, setError] = useState("");

  const encryptedList = useMemo(() => rows.map((row) => String(row.c)).join(", "), [rows]);
  const receivedDecryptedMessage = useMemo(() => receivedRows.map((row) => row.char).join(""), [receivedRows]);

  function handleGenerateKeys() {
    try {
      const newKeys = generateKeys();
      setKeys(newKeys);
      setPublicE(String(newKeys.e));
      setPublicN(String(newKeys.n));
      setRows([]);
      setReceivedRows([]);
      setReceivedCipher("");
      setError("");
      setActiveTab("keys");
    } catch (err) {
      setError(err instanceof Error ? err.message : "鍵生成でエラーが発生しました。");
    }
  }

  function handleMessageChange(value: string) {
    setMessage(value.toUpperCase().replace(/ /g, ""));
  }

  function handlePublicEChange(value: string) {
    setPublicE(value.replace(/ /g, ""));
  }

  function handlePublicNChange(value: string) {
    setPublicN(value.replace(/ /g, ""));
  }

  function handleEncrypt() {
    const validation = validateMessage(message);
    if (validation !== null) {
      setError(validation);
      setRows([]);
      return;
    }

    try {
      const e = parsePositiveInteger(publicE, "公開鍵 e");
      const n = parsePositiveInteger(publicN, "公開鍵 n");
      if (n <= 26) throw new Error("公開鍵 n は 26 より大きい整数にしてください。");

      const nextRows = Array.from(message).map((char) => {
        const m = charToNumber(char);
        const k = encodingMode === "randomized" ? pickRandomK(m, n) : 0;
        const mPrime = m + 26 * k;
        const c = modPow(mPrime, e, n);
        return { char, m, mPrime, c };
      });

      setRows(nextRows);
      setReceivedCipher(nextRows.map((row) => String(row.c)).join(", "));
      setReceivedRows([]);
      setError("");
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "暗号化でエラーが発生しました。");
    }
  }

  function parseCipherText(text: string): number[] {
    const parts = text.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
    if (parts.length === 0) throw new Error("暗号文の数列を入力してください。");
    return parts.map((part) => {
      const value = Number(part);
      if (!Number.isInteger(value)) throw new Error("暗号文はカンマ区切りの整数で入力してください。");
      return value;
    });
  }

  function handleReceivedDecrypt() {
    if (keys === null) {
      setError("復号するには、自分の秘密鍵を作っておく必要があります。先に『ランダムに素数を作る』を押してください。");
      return;
    }

    try {
      const cipherNumbers = parseCipherText(receivedCipher);
      const nextRows = cipherNumbers.map((c) => {
        const mPrime = modPow(c, keys.d, keys.n);
        const m = encodingMode === "randomized" ? (mPrime % 26 === 0 ? 26 : mPrime % 26) : mPrime;
        return { c, mPrime, m, char: numberToChar(m) };
      });
      setReceivedRows(nextRows);
      setError("");
    } catch (err) {
      setReceivedRows([]);
      setError(err instanceof Error ? err.message : "復号でエラーが発生しました。");
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app-shell">
        <main className="container">
          <section className="hero-card">
            <div className="hero-main">
              <div className="eyebrow">RSA Encryption Experience</div>
              <h1>RSA暗号体験アプリ</h1>
              <p>送信者は、相手から受け取った公開鍵を使って暗号文を作ります。受信者は、自分だけが持つ秘密鍵を使って復号します。</p>
            </div>
            <nav className="tabs">
              <TabButton active={activeTab === "keys"} onClick={() => setActiveTab("keys")}>1. 鍵を作る</TabButton>
              <TabButton active={activeTab === "encrypt"} onClick={() => setActiveTab("encrypt")}>2. 暗号文を作る</TabButton>
              <TabButton active={activeTab === "decrypt"} onClick={() => setActiveTab("decrypt")}>3. 復号する</TabButton>
            </nav>
          </section>

          {error && <div className="error-box">{error}</div>}

          {activeTab === "keys" && (
            <section className="panel">
              <SectionHeader number="01" title="鍵を作る画面" description="受信者として使う鍵を作ります。公開鍵は相手に伝え、秘密鍵は自分だけが隠します。" />
              <div className="action-card">
                <div>
                  <div className="small-label">Prime Generator</div>
                  <div className="action-title">30〜100の素数からランダムに選びます</div>
                </div>
                <button className="primary-button dark" onClick={handleGenerateKeys}>ランダムに素数を作る</button>
              </div>

              {keys ? (
                <div className="stack">
                  <div className="two-grid">
                    <div className="key-card public">
                      <div className="key-label">相手に伝える情報</div>
                      <div className="key-value">公開鍵：({keys.e}, {keys.n})</div>
                      <p>相手はこの公開鍵を使って、あなた宛ての暗号文を作ります。</p>
                    </div>
                    <div className="key-card secret">
                      <div className="key-label">自分だけが隠しておく情報</div>
                      <div className="key-value">秘密鍵：({keys.d}, {keys.n})</div>
                      <p>暗号文を復号するための情報です。p, q, φ(n), d は本来秘密です。</p>
                    </div>
                  </div>
                  <div className="four-grid">
                    <InfoBox label="本来は秘密にする素数" value={`p = ${keys.p}, q = ${keys.q}`} />
                    <InfoBox label="公開してよい n = p × q" value={String(keys.n)} detail={`${keys.p} × ${keys.q} = ${keys.n}`} />
                    <InfoBox label="本来は秘密の φ(n)" value={String(keys.phi)} detail={`${keys.p - 1} × ${keys.q - 1} = ${keys.phi}`} />
                    <InfoBox label="公開指数 e と秘密指数 d" value={`e = ${keys.e}`} detail={`d = ${keys.d}`} />
                  </div>
                </div>
              ) : (
                <EmptyBox>まだ鍵は生成されていません。ボタンを押すと、p, q, n, φ(n), e, d が表示されます。</EmptyBox>
              )}
            </section>
          )}

          {activeTab === "encrypt" && (
            <section className="panel">
              <SectionHeader number="02" title="暗号文を作る画面" description="相手から受け取った公開鍵 (e, n) を入力し、その公開鍵で暗号化します。文字の数値化は、単純方式とランダム化方式から選べます。" />

              <div className="mode-section">
                <div className="small-label">文字の数値化方式</div>
                <div className="two-grid compact">
                  <ModeCard checked={encodingMode === "simple"} title="単純方式：A=1, B=2, ..." description="対応関係が見えやすく、RSAの基本計算を理解しやすい方式です。" onChange={() => setEncodingMode("simple")} />
                  <ModeCard checked={encodingMode === "randomized"} title="ランダム化方式：m' = m + 26k" description="同じ文字でも毎回違う値にしてから暗号化する方式です。" onChange={() => setEncodingMode("randomized")} />
                </div>
              </div>

              <div className="two-grid input-grid">
                <TextInput label="受け取った公開鍵 e" value={publicE} onChange={handlePublicEChange} placeholder="例：7" />
                <TextInput label="受け取った公開鍵 n" value={publicN} onChange={handlePublicNChange} placeholder="例：1517" />
              </div>

              <div className="input-card">
                <label>暗号文にする文章</label>
                <div className="inline-form">
                  <input value={message} onChange={(event) => handleMessageChange(event.target.value)} maxLength={MAX_LENGTH} placeholder="例：SOSUUDAISUKI" />
                  <button className="primary-button blue" onClick={handleEncrypt}>暗号化する</button>
                </div>
                <div className="count">現在 {message.length} / {MAX_LENGTH} 文字</div>
              </div>

              {rows.length > 0 && (
                <div className="result-card">
                  <h3>相手に渡す暗号文</h3>
                  <FormulaBox>{encodingMode === "randomized" ? "ランダム化方式：m' = m + 26k,  c ≡ (m')^e mod n" : "単純方式：m = 1..26,  c ≡ m^e mod n"}　/　入力した公開鍵では e = {publicE}, n = {publicN}</FormulaBox>
                  <EncryptTable rows={rows} e={Number(publicE)} n={Number(publicN)} />
                  <div className="cipher-box">
                    <div className="small-label">相手に渡すもの：暗号文の数列</div>
                    <div className="cipher-text">[{encryptedList}]</div>
                    <p>この数列は渡してよい情報です。相手は自分の秘密鍵で復号します。</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "decrypt" && (
            <section className="panel">
              <SectionHeader number="03" title="復号する画面" description="自分宛てに届いた暗号文の数列を入力し、自分だけが持つ秘密鍵 (d, n) で復号します。公開鍵だけでは復号できません。" />
              {keys ? (
                <div className="secret-strip">
                  <div className="small-label">復号に使う秘密鍵</div>
                  <div className="secret-value">({keys.d}, {keys.n})</div>
                  <p>これは相手に渡さない情報です。</p>
                </div>
              ) : (
                <EmptyBox>復号するには、先に「鍵を作る」画面で自分の鍵を作ってください。</EmptyBox>
              )}

              <div className="input-card">
                <label>受け取った暗号文の数列</label>
                <div className="inline-form">
                  <input value={receivedCipher} onChange={(event) => setReceivedCipher(event.target.value)} placeholder="例：663, 781, 1409" />
                  <button className="primary-button green" onClick={handleReceivedDecrypt}>復号する</button>
                </div>
              </div>
              {keys && <FormulaBox>{encodingMode === "randomized" ? "復号：m' ≡ c^d mod n,  m は m' mod 26 で戻す" : "復号：m ≡ c^d mod n"}　/　自分の秘密鍵では d = {keys.d}, n = {keys.n}</FormulaBox>}
              {receivedRows.length > 0 && keys && (
                <>
                  <DecryptTable rows={receivedRows} d={keys.d} n={keys.n} />
                  <div className="final-answer">
                    <div className="small-label">復号結果</div>
                    <div>{receivedDecryptedMessage}</div>
                  </div>
                </>
              )}
            </section>
          )}

          <section className="panel math-panel">
            <SectionHeader number="Math" title="数学のポイント" description="RSAで使う計算を、公開するものと隠すものに分けて確認します。" />
            <div className="math-grid">
              <MathLine title="1. 素数から n を作る" formula="n = p × q" />
              <MathLine title="2. オイラーの φ 関数" formula="φ(n) = (p - 1)(q - 1)" />
              <MathLine title="3. 公開鍵：相手に伝える" formula="(e, n)" />
              <MathLine title="4. 秘密鍵：自分だけが隠す" formula="(d, n),  e × d ≡ 1 mod φ(n)" />
              <MathLine title="5. 暗号化：受け取った公開鍵を使う" formula="c ≡ m^e mod n" />
              <MathLine title="6. 復号：自分の秘密鍵を使う" formula="m ≡ c^d mod n" />
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function SectionHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="section-header">
      <div className="section-number">{number}</div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={active ? "tab active" : "tab"}>{children}</button>;
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="text-input">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function ModeCard({ checked, title, description, onChange }: { checked: boolean; title: string; description: string; onChange: () => void }) {
  return (
    <label className={checked ? "mode-card selected" : "mode-card"}>
      <input type="radio" checked={checked} onChange={onChange} />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function InfoBox({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="info-box">
      <div className="small-label">{label}</div>
      <div className="info-value">{value}</div>
      {detail && <div className="info-detail">{detail}</div>}
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return <div className="empty-box">{children}</div>;
}

function FormulaBox({ children }: { children: React.ReactNode }) {
  return <div className="formula-box">{children}</div>;
}

function MathLine({ title, formula }: { title: string; formula: string }) {
  return (
    <div className="math-line">
      <strong>{title}</strong>
      <code>{formula}</code>
    </div>
  );
}

function EncryptTable({ rows, e, n }: { rows: EncRow[]; e: number; n: number }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>文字</th>
            <th>数値 m</th>
            <th>暗号化前の値</th>
            <th>公開鍵で暗号化</th>
            <th>暗号文 c</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`enc-${index}`}>
              <td className="big-cell">{row.char}</td>
              <td>{row.m}</td>
              <td>{row.mPrime}</td>
              <td>{row.mPrime}^{e} mod {n}</td>
              <td className="cipher-cell">{row.c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecryptTable({ rows, d, n }: { rows: DecryptRow[]; d: number; n: number }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>受け取った暗号文 c</th>
            <th>秘密鍵で復号</th>
            <th>復号値</th>
            <th>文字番号 m</th>
            <th>文字</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`dec-${index}`}>
              <td className="cipher-cell green-text">{row.c}</td>
              <td>{row.c}^{d} mod {n}</td>
              <td>{row.mPrime}</td>
              <td>{row.m}</td>
              <td className="big-cell">{row.char}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = `
* { box-sizing: border-box; }
html, body, #root { margin: 0; min-height: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; }
button, input { font: inherit; }
.app-shell {
  min-height: 100vh;
  background: radial-gradient(circle at top left, #3b82f6 0, transparent 28%), linear-gradient(135deg, #020617 0%, #111827 45%, #312e81 100%);
  padding: 36px 18px;
}
.container { max-width: 1120px; margin: 0 auto; }
.hero-card, .panel {
  background: rgba(255,255,255,0.96);
  border-radius: 30px;
  box-shadow: 0 24px 70px rgba(2, 6, 23, 0.28);
  overflow: hidden;
}
.hero-card { margin-bottom: 26px; }
.hero-main {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: white;
  padding: 42px;
}
.eyebrow {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.16);
  border: 1px solid rgba(255,255,255,0.25);
  font-weight: 800;
  font-size: 13px;
}
h1 { margin: 16px 0 0; font-size: clamp(38px, 6vw, 64px); letter-spacing: -0.04em; line-height: 1; }
.hero-main p {
  margin: 18px 0 0;
  max-width: 100%;
  color: #dbeafe;
  line-height: 1.8;
  font-size: 17px;
  white-space: nowrap;
}
.tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 18px;
  background: #f1f5f9;
}
.tab {
  border: 0;
  border-radius: 18px;
  padding: 16px;
  background: white;
  color: #334155;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15,23,42,0.06);
}
.tab.active { background: #0f172a; color: white; }
.panel { padding: 32px; margin-bottom: 26px; }
.section-header { display: flex; gap: 18px; align-items: flex-start; }
.section-number {
  width: 58px; height: 58px; flex: 0 0 58px;
  display: grid; place-items: center;
  border-radius: 18px;
  background: #0f172a; color: white; font-weight: 1000;
  box-shadow: 0 10px 24px rgba(15,23,42,.22);
}
h2 { margin: 0; font-size: 30px; letter-spacing: -0.03em; }
.section-header p { margin: 9px 0 0; color: #64748b; line-height: 1.75; }
.action-card, .input-card, .mode-section, .result-card {
  margin-top: 24px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.action-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.small-label { color: #64748b; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
.action-title { margin-top: 5px; font-size: 21px; font-weight: 950; color: #0f172a; }
.primary-button {
  border: 0; border-radius: 18px; padding: 16px 24px;
  color: white; font-weight: 950; cursor: pointer;
  box-shadow: 0 14px 30px rgba(15,23,42,.18);
  transition: transform .15s, filter .15s;
}
.primary-button:hover { transform: translateY(-2px); filter: brightness(1.05); }
.dark { background: #0f172a; }
.blue { background: #1d4ed8; }
.green { background: #047857; }
.stack { margin-top: 24px; display: grid; gap: 18px; }
.two-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.four-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.key-card, .info-box {
  border-radius: 24px;
  padding: 22px;
  border: 1px solid #e2e8f0;
}
.key-card.public { background: linear-gradient(135deg, #eff6ff, #dbeafe); border-color: #bfdbfe; }
.key-card.secret { background: linear-gradient(135deg, #fff1f2, #ffe4e6); border-color: #fecdd3; }
.key-label { font-weight: 950; color: #1e40af; }
.secret .key-label { color: #be123c; }
.key-value { margin-top: 12px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.75); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24px; font-weight: 1000; }
.key-card p { color: #475569; line-height: 1.65; }
.info-box { background: #f8fafc; }
.info-value { margin-top: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 20px; font-weight: 1000; color: #0f172a; word-break: break-word; }
.info-detail { margin-top: 8px; color: #64748b; font-weight: 800; }
.empty-box { margin-top: 24px; border: 2px dashed #cbd5e1; background: #f8fafc; color: #64748b; border-radius: 22px; padding: 24px; font-weight: 800; }
.compact { margin-top: 14px; }
.mode-card {
  display: flex; gap: 14px; border-radius: 22px; padding: 18px;
  background: white; border: 1px solid #e2e8f0; cursor: pointer;
}
.mode-card.selected { border: 2px solid #2563eb; background: #eff6ff; }
.mode-card strong { display: block; color: #0f172a; }
.mode-card small { display: block; color: #64748b; margin-top: 7px; line-height: 1.55; }
.input-grid { margin-top: 22px; }
.text-input, .input-card { display: block; background: white; }
.text-input { border-radius: 22px; padding: 18px; border: 1px solid #e2e8f0; }
.text-input span, .input-card label { color: #334155; font-size: 14px; font-weight: 950; }
.text-input input, .inline-form input {
  width: 100%; height: 54px; margin-top: 10px;
  border: 1px solid #cbd5e1; border-radius: 16px;
  padding: 0 15px; outline: none; font-size: 18px; font-weight: 800;
}
.text-input input:focus, .inline-form input:focus { border-color: #2563eb; box-shadow: 0 0 0 4px #dbeafe; }
.inline-form { display: flex; gap: 12px; align-items: flex-end; }
.count { margin-top: 8px; color: #64748b; font-weight: 700; }
.error-box { background: #fffbeb; color: #92400e; border: 1px solid #fcd34d; padding: 16px 20px; border-radius: 20px; font-weight: 950; margin-bottom: 22px; }
.formula-box { margin-top: 18px; padding: 16px; border-radius: 18px; background: #1e1b4b; color: #eef2ff; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800; line-height: 1.7; }
.table-wrap { margin-top: 18px; overflow-x: auto; background: white; border: 1px solid #e2e8f0; border-radius: 22px; }
table { width: 100%; min-width: 780px; border-collapse: collapse; }
th { background: #0f172a; color: white; text-align: left; padding: 15px; font-size: 13px; }
td { padding: 15px; border-top: 1px solid #e2e8f0; font-weight: 700; }
tbody tr:nth-child(even) { background: #f8fafc; }
.big-cell { font-size: 20px; font-weight: 1000; }
.cipher-cell { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #1d4ed8; font-size: 18px; font-weight: 1000; }
.green-text { color: #047857; }
.cipher-box { margin-top: 20px; background: white; border: 1px solid #e2e8f0; border-radius: 24px; padding: 20px; }
.cipher-text { margin-top: 10px; background: #0f172a; color: white; border-radius: 18px; padding: 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px; font-weight: 950; word-break: break-word; }
.cipher-box p { color: #64748b; font-weight: 700; }
.secret-strip { margin-top: 24px; border: 1px solid #fecdd3; background: #fff1f2; color: #881337; border-radius: 24px; padding: 22px; }
.secret-value { margin-top: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 26px; font-weight: 1000; }
.final-answer { margin-top: 20px; border-radius: 24px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 22px; color: #064e3b; }
.final-answer div:last-child { margin-top: 8px; font-size: 36px; font-weight: 1000; letter-spacing: .08em; }
.math-panel { background: rgba(255,255,255,.96); }
.math-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
.math-line { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 22px; padding: 18px; }
.math-line strong { display: block; color: #0f172a; }
.math-line code { display: block; margin-top: 12px; padding: 12px; border-radius: 14px; background: white; color: #334155; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
@media (max-width: 800px) {
  .hero-main { padding: 28px; }
  .tabs, .two-grid, .four-grid, .math-grid { grid-template-columns: 1fr; }
  .panel { padding: 22px; }
  .section-header { flex-direction: column; }
  .action-card, .inline-form { flex-direction: column; align-items: stretch; }
  .primary-button { width: 100%; }
}
`;
