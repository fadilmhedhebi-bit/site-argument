import { Capacitor, registerPlugin } from '@capacitor/core';

// Pont vers le plugin natif iOS/Android qui parlera au lecteur de carte SumUp
// en Bluetooth (SumUp SDK). Le plugin natif lui-meme reste a ecrire (Swift +
// SumUpSDK CocoaPod) une fois qu'un compte marchand SumUp et un lecteur
// physique sont disponibles pour le developper et le tester - voir
// ios/App/SUMUP.md pour le detail de ce qui manque.
//
// Contrat attendu du plugin natif :
//   charge({ amountCents, currency, title }) -> { transactionCode }
//   en cas d'echec ou d'annulation par le client, la promesse est rejetee.
const SumUpPlugin = registerPlugin('SumUp');

export function isSumUpAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SumUp');
}

// amountEuros: nombre (ex: 12.50) ; title: libelle affiche sur le lecteur.
// Renvoie { transactionCode } en cas de succes.
// Leve une erreur (paiement refuse, annule, ou plugin non disponible) sinon.
export async function chargeWithSumUp(amountEuros, title) {
  if (!isSumUpAvailable()) {
    throw new Error("Lecteur SumUp non disponible sur cet appareil");
  }
  const amountCents = Math.round(amountEuros * 100);
  const result = await SumUpPlugin.charge({ amountCents, currency: 'EUR', title });
  if (!result?.transactionCode) {
    throw new Error('Paiement SumUp non confirmé');
  }
  return { transactionCode: result.transactionCode };
}
