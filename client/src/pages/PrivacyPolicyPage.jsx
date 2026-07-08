import RestoLabLogo from '../components/RestoLabLogo';

const LAST_UPDATED = '8 juillet 2026';
const CONTACT_EMAIL = 'fadilmhedhebi@gmail.com';

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2.5">
          <RestoLabLogo size={28} />
          <span className="text-lg font-bold text-gray-900">RestoLab</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Politique de confidentialité</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {LAST_UPDATED}</p>

        <Section title="1. Qui sommes-nous">
          <p>
            RestoLab est une plateforme logicielle de gestion pour restaurants et commerces de restauration
            (prise de commandes, caisse, réservations, tournées de livraison, gestion d'équipe). Cette
            politique de confidentialité décrit comment nous collectons, utilisons et protégeons les données
            personnelles des utilisateurs de RestoLab : les commerces clients, leur personnel, et les clients
            finaux qui passent commande via RestoLab.
          </p>
          <p>
            Pour toute question relative à cette politique ou à vos données personnelles, contactez-nous à
            l'adresse : <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="2. Données que nous collectons">
          <p><strong>Comptes commerce et personnel :</strong> nom du commerce, adresse, coordonnées, nom/prénom/email/téléphone des membres de l'équipe, mot de passe (stocké de façon chiffrée).</p>
          <p><strong>Clients finaux :</strong> nom, numéro de téléphone, adresse de livraison, email (facultatif), historique de commandes, points de fidélité le cas échéant.</p>
          <p><strong>Commandes :</strong> contenu du panier, montants, mode de paiement, statut de préparation/livraison, notes de commande.</p>
          <p><strong>Géolocalisation :</strong> position GPS des livreurs pendant une tournée active, à des fins de suivi de livraison en temps réel (jamais collectée en dehors d'une tournée active).</p>
          <p><strong>Facturation :</strong> les paiements d'abonnement RestoLab sont traités par Stripe ; nous ne stockons jamais de numéro de carte bancaire sur nos serveurs.</p>
          <p><strong>Commandes issues de plateformes tierces :</strong> si un commerce active une intégration avec Uber Eats et/ou Deliveroo, les commandes transmises par ces plateformes (nom du client, adresse de livraison, contenu de la commande) sont importées dans RestoLab afin d'être traitées comme toute autre commande.</p>
        </Section>

        <Section title="3. Finalités du traitement">
          <p>Nous utilisons ces données pour :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Permettre la prise, la préparation et la livraison des commandes</li>
            <li>Gérer les comptes utilisateurs et les droits d'accès par rôle</li>
            <li>Assurer le suivi en temps réel des livraisons</li>
            <li>Gérer la facturation et les abonnements RestoLab</li>
            <li>Envoyer des communications transactionnelles (confirmation de commande, réinitialisation de mot de passe, etc.)</li>
            <li>Assurer la sécurité et prévenir la fraude</li>
            <li>Respecter nos obligations légales et fiscales (notamment la conservation des données de facturation)</li>
          </ul>
        </Section>

        <Section title="4. Base légale">
          <p>
            Le traitement repose sur l'exécution du contrat qui nous lie au commerce client (abonnement RestoLab)
            et à ses clients finaux (traitement de leur commande), sur notre intérêt légitime (sécurité,
            amélioration du service) et sur le respect de nos obligations légales (facturation, conservation
            fiscale).
          </p>
        </Section>

        <Section title="5. Partage des données">
          <p>Nous partageons certaines données avec des prestataires techniques, uniquement dans la mesure nécessaire au fonctionnement du service :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Stripe</strong> — traitement des paiements d'abonnement</li>
            <li><strong>SumUp</strong> — traitement des paiements par carte en caisse</li>
            <li><strong>Brevo</strong> — envoi d'emails transactionnels</li>
            <li><strong>Render</strong> — hébergement de l'application et de la base de données</li>
            <li><strong>Uber Eats / Deliveroo</strong> — uniquement pour les commerces ayant explicitement activé cette intégration, afin de recevoir leurs commandes</li>
          </ul>
          <p>Nous ne vendons jamais de données personnelles à des tiers.</p>
        </Section>

        <Section title="6. Durée de conservation">
          <p>
            Les données de commande sont conservées pendant la durée nécessaire à leur traitement, puis
            archivées conformément aux obligations légales de conservation des documents commerciaux et
            fiscaux (10 ans pour les données de facturation en France). Les comptes utilisateurs sont
            conservés tant que le compte est actif, puis supprimés ou anonymisés dans un délai raisonnable
            après la clôture du compte.
          </p>
        </Section>

        <Section title="7. Vos droits">
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit
            d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos
            données. Pour exercer ces droits, contactez-nous à{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 underline">{CONTACT_EMAIL}</a>.
            Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr).
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            RestoLab utilise uniquement des cookies strictement nécessaires au fonctionnement du service
            (maintien de la session de connexion). Nous n'utilisons pas de cookies publicitaires ou de
            traceurs tiers à des fins de suivi marketing.
          </p>
        </Section>

        <Section title="9. Sécurité">
          <p>
            Les mots de passe sont stockés sous forme chiffrée (hachage bcrypt). Les communications entre
            l'application et nos serveurs sont chiffrées (HTTPS). L'accès aux données d'un commerce est
            restreint aux membres de son équipe, selon leur rôle.
          </p>
        </Section>

        <Section title="10. Modifications de cette politique">
          <p>
            Cette politique de confidentialité peut être mise à jour périodiquement. La date de dernière
            mise à jour figure en haut de cette page. En cas de modification substantielle, les commerces
            clients en seront informés par email.
          </p>
        </Section>
      </main>
    </div>
  );
}
