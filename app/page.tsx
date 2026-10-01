export default function Home() {
  return (
    <main style={{ maxWidth: 680, margin: '64px auto', padding: 24, fontFamily: 'system-ui' }}>
      <p>CHASUM · ISSUE 136</p>
      <h1>Disposable release-control fixture</h1>
      <p>This synthetic app supports Preview, Production blocking, and exact-commit release proofs.</p>
      <p>Feature marker: deployment-policy-preview-proof</p>
      <a href="/api/identity">Read this deployment’s identity</a>
    </main>
  );
}
