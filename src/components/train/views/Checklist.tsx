import { NotimerPractice } from '../../ao1k/NotimerPractice'
import { createNotimerChecklistStore } from '../../../storage/notimerStore'

const store = createNotimerChecklistStore()

export function ChecklistTrainer() {
  return <NotimerPractice store={store} />
}
