// Near-miss severity and category are decided by fixed rules, never by the LLM.
// Mirrors incident_rules() in ml/api.py; keep the two in step.

const SEVERITY = ['Low', 'Medium', 'High'] as const
const VEHICLE_WORDS = /dumper|dumpar|truck|tipper|lorry|tractor|gaadi|gadi|vehicle|loader/i
const PERSON_WORDS = /worker|aadmi|admi|labou?r|person|banda|helper|mazdoor|log\b/i

/** Black box: closest worker < 7 m → High, < 11 m → Medium, else Low; working/swinging raises one level. */
export function incidentRules(transcript: string, minDistM: number, machineState: string) {
  let level = minDistM < 7 ? 2 : minDistM < 11 ? 1 : 0
  let basis = minDistM < 99 ? `Closest worker ${minDistM.toFixed(1)} m in last 60 s` : 'No worker near the machine in last 60 s'
  if (/^working/i.test(machineState) && level < 2) {
    level += 1
    basis += '; machine was working/swinging (+1 level)'
  }
  const category = VEHICLE_WORDS.test(transcript) ? 'Vehicle interaction'
    : PERSON_WORDS.test(transcript) || minDistM < 11 ? 'Person in swing zone' : 'Other'
  return { severity: SEVERITY[level], severity_basis: basis, category }
}

/** Where each report field came from, for the small provenance markers in the report dialog. */
export type FieldSource = 'black box' | 'rule' | 'machine position' | 'LLM' | 'template'
export const OFFLINE_SOURCES: Record<string, FieldSource> = {
  category: 'rule', severity: 'black box', severity_basis: 'black box', machine_state: 'black box',
  location: 'machine position', suggested_action: 'template',
}
