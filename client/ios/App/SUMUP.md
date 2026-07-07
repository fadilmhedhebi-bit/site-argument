# Intégration SumUp — ce qui reste à faire

Le code JS (`client/src/sumup.js`) et le flux de caisse (`CaisseTab.jsx`) sont
prêts à appeler un plugin Capacitor natif nommé `SumUp`. Ce plugin n'existe
pas encore : il faut l'écrire côté iOS (Swift) une fois les prérequis
ci-dessous réunis. Tant qu'il n'existe pas, `isSumUpAvailable()` renvoie
`false` et l'app retombe automatiquement sur la saisie manuelle du paiement
carte (comportement actuel, inchangé).

## Prérequis (côté business, pas du code)

1. Compte marchand SumUp (inscription + vérification d'identité de
   l'entreprise sur sumup.com)
2. Un lecteur de carte SumUp physique (Air ou Solo)
3. Les clés d'API SumUp (Affiliate Key / App ID), récupérées depuis le
   compte développeur SumUp une fois le compte marchand créé
4. Un Mac avec Xcode pour compiler et tester (le simulateur iOS ne peut pas
   parler à un lecteur Bluetooth réel — il faut un iPhone/iPad physique)

## Travail technique restant

1. Ajouter le SumUp SDK iOS au projet (`ios/App/Podfile`, pod
   `SumUpSDK`), ou via Swift Package Manager selon la version du SDK.
2. Créer un plugin Capacitor natif (`ios/App/App/SumUpPlugin.swift`) qui :
   - expose une méthode `charge(amountCents, currency, title)`
   - lance le flow de paiement SumUp (`SMPCheckoutViewController` ou
     l'API SDK équivalente selon leur doc à jour)
   - retourne `{ transactionCode }` au JS via le callback du plugin en cas
     de succès, ou une erreur en cas d'échec/annulation
3. Déclarer le plugin dans `ios/App/App/capacitor.config.json` /
   l'enregistrement Swift standard Capacitor (`CAPBridgeViewController`)
4. Ajouter les permissions Bluetooth requises dans `Info.plist`
   (`NSBluetoothAlwaysUsageDescription`)
5. Configurer les clés API SumUp (ne jamais les committer en dur — les
   charger depuis la config native ou un fichier non versionné)
6. Tester avec le lecteur physique sur un vrai iPhone/iPad

## Pourquoi ce n'est pas fait maintenant

Cette partie nécessite un compte marchand SumUp actif, un lecteur physique,
et un Mac pour compiler/tester en conditions réelles — aucun de ces trois
n'est disponible dans l'environnement de développement actuel. Une fois ces
trois éléments réunis, revenir sur cette tâche avec la documentation SumUp
à jour (l'API du SDK évolue, à vérifier au moment de l'implémentation
plutôt que de se fier à une version mémorisée).
