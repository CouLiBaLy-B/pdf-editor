import { Link, useLocation } from 'react-router-dom'
import { AppLogo } from '../components/ui/index.js'

const operator = import.meta.env.VITE_LEGAL_NAME || 'PDFPro'
const contact = import.meta.env.VITE_LEGAL_EMAIL || 'support@pdfpro.app'
const retention = import.meta.env.VITE_FILE_RETENTION_DAYS || '30'

function Section({ id, title, children }) {
  return <section id={id} className="scroll-mt-24 border-b border-border pb-8 last:border-0"><h2 className="mb-3 text-lg font-bold text-ink">{title}</h2><div className="space-y-3 text-sm leading-7 text-ink-muted">{children}</div></section>
}

export default function LegalPage() {
  const { pathname } = useLocation()
  const initial = pathname === '/privacy' ? 'confidentialite' : pathname === '/terms' ? 'cgu' : 'mentions'

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Link to="/"><AppLogo /></Link>
          <Link to="/" className="text-xs font-medium text-ink-muted hover:text-ink">← Retour à l’accueil</Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-4xl gap-8 px-6 py-10 md:grid-cols-[190px_1fr]">
        <nav className="h-fit space-y-1 rounded-xl border border-border bg-white p-2 md:sticky md:top-20">
          {[['mentions','Mentions légales'],['confidentialite','Confidentialité'],['cgu','Conditions d’utilisation']].map(([id,label]) => (
            <a key={id} href={`#${id}`} className={`block rounded-lg px-3 py-2 text-xs ${initial === id ? 'bg-brand-light font-semibold text-brand' : 'text-ink-muted hover:bg-surface-raised'}`}>{label}</a>
          ))}
        </nav>
        <article className="space-y-8 rounded-2xl border border-border bg-white p-6 md:p-10">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-brand">Informations légales</p><h1 className="mt-2 text-3xl font-extrabold text-ink">PDFPro, en toute transparence</h1><p className="mt-2 text-xs text-ink-faint">Dernière mise à jour : 19 août 2026</p></div>

          <Section id="mentions" title="Mentions légales">
            <p>Le service PDFPro est édité par <strong>{operator}</strong>. Pour toute demande juridique, commerciale ou liée au support, écrivez à <a className="text-brand hover:underline" href={`mailto:${contact}`}>{contact}</a>.</p>
            <p>L’hébergement applicatif est assuré par Railway. Les documents peuvent être stockés sur Cloudflare R2, selon la configuration de l’environnement de production.</p>
          </Section>

          <Section id="confidentialite" title="Politique de confidentialité">
            <p>Nous traitons votre adresse email, les informations nécessaires à votre compte, l’historique de crédits et les documents que vous choisissez d’importer. Ces données servent uniquement à fournir, sécuriser et facturer le service.</p>
            <p>Les paiements sont traités par Stripe. PDFPro ne reçoit ni ne conserve votre numéro complet de carte bancaire. Les emails transactionnels sont envoyés via Resend.</p>
            <p>Les documents inactifs sont supprimés automatiquement après <strong>{retention} jours</strong>. Vous pouvez les supprimer immédiatement depuis l’application. La suppression du compte entraîne la suppression des fichiers associés.</p>
            <p>Vous pouvez demander l’accès, la rectification, l’effacement ou l’export de vos données à <a className="text-brand hover:underline" href={`mailto:${contact}`}>{contact}</a>. Les liens de partage expirent après 7 jours et peuvent être révoqués.</p>
            <p>Des journaux techniques minimaux sont conservés pour la sécurité et le diagnostic. Le contenu des PDF et les jetons de partage ne sont pas inscrits dans les journaux applicatifs.</p>
          </Section>

          <Section id="cgu" title="Conditions générales d’utilisation">
            <p>Vous devez disposer des droits nécessaires sur les documents importés. Il est interdit d’utiliser PDFPro pour traiter ou diffuser un contenu illégal, frauduleux ou portant atteinte aux droits d’un tiers.</p>
            <p>Un crédit correspond à une opération PDF terminée avec succès. Les limites techniques affichées dans l’application s’appliquent à chaque opération. Les crédits achetés ne constituent pas un abonnement.</p>
            <p>Une signature dessinée dans PDFPro est une représentation graphique apposée au document. Elle ne constitue pas automatiquement une signature électronique qualifiée au sens du règlement eIDAS.</p>
            <p>Le service peut être temporairement interrompu pour maintenance ou incident. Il appartient à l’utilisateur de conserver une copie des documents importants après traitement.</p>
          </Section>
        </article>
      </main>
    </div>
  )
}
