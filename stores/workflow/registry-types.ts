export interface WorkflowMetadata {
  id: string
  name: string
  lastModified: Date
  description?: string
  color?: string
}

export interface WorkflowRegistryState {
  workflows: Record<string, WorkflowMetadata>
  activeWorkflowId: string | null
  isLoading: boolean
  error: string | null
}

export interface WorkflowRegistryActions {
  setActiveWorkflow: (id: string) => Promise<void>
  addWorkflow: (metadata: WorkflowMetadata) => void
  removeWorkflow: (id: string) => void
  updateWorkflow: (id: string, metadata: Partial<WorkflowMetadata>) => void
}

export type WorkflowRegistry = WorkflowRegistryState & WorkflowRegistryActions
