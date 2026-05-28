import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { evaluateRules, listRules, resetRuleEngineStore, seedDefaultRules } from './store';

export function seedRuleEngine(organizationId = 1) {
  const signals = seedDemoAiSignals(organizationId);
  seedDefaultRules(organizationId);
  const evaluation = evaluateRules(organizationId);
  return { signals, rules: { count: listRules(organizationId).length }, evaluation };
}

export { seedDefaultRules };
