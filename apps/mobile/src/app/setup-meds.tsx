import NewMedication from './medication-new';

/** First run: pick medicines before Home (the same screen as "add medicine", without the way back). */
export default function SetupMeds() {
  return <NewMedication first />;
}
