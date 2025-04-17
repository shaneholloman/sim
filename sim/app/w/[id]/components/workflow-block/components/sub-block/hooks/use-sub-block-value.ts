import { useCallback, useEffect, useRef } from 'react'
import { isEqual } from 'lodash'
import { useGeneralStore } from '@/stores/settings/general/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getProviderFromModel } from '@/providers/utils'

/**
 * Helper to handle API key auto-fill for provider-based blocks
 * Used for agent, router, evaluator, and any other blocks that use LLM providers
 */
function handleProviderBasedApiKey(
  blockId: string,
  subBlockId: string,
  modelValue: string | null | undefined,
  storeValue: any
) {
  // Only proceed if we have a model selected
  if (!modelValue) return

  // Get the provider for this model
  const provider = getProviderFromModel(modelValue)

  // Skip if we couldn't determine a provider
  if (!provider || provider === 'ollama') return

  const subBlockStore = useSubBlockStore.getState()

  // Try to get a saved API key for this provider
  const savedValue = subBlockStore.resolveToolParamValue(provider, 'apiKey', blockId)

  // If we have a valid API key, use it
  if (savedValue && savedValue !== '') {
    // Always update the value when switching models, even if it appears the same
    // This handles cases where the field shows masked values but needs to update
    subBlockStore.setValue(blockId, subBlockId, savedValue)
  } else {
    // Always clear the field when switching to a model with no API key
    // Don't wait for user interaction to clear it
    subBlockStore.setValue(blockId, subBlockId, '')
  }
}

/**
 * Helper to handle API key auto-fill for non-agent blocks
 */
function handleStandardBlockApiKey(
  blockId: string,
  subBlockId: string,
  blockType: string | undefined,
  storeValue: any
) {
  if (!blockType) return

  const subBlockStore = useSubBlockStore.getState()

  // Only auto-fill if the field is empty
  if (!storeValue || storeValue === '') {
    // Pass the blockId as instanceId to check if this specific instance has been cleared
    const savedValue = subBlockStore.resolveToolParamValue(blockType, 'apiKey', blockId)

    if (savedValue && savedValue !== '' && savedValue !== storeValue) {
      // Auto-fill the API key from the param store
      subBlockStore.setValue(blockId, subBlockId, savedValue)
    }
  }
  // Handle environment variable references
  else if (
    storeValue &&
    typeof storeValue === 'string' &&
    storeValue.startsWith('{{') &&
    storeValue.endsWith('}}')
  ) {
    // Pass the blockId as instanceId
    const currentValue = subBlockStore.resolveToolParamValue(blockType, 'apiKey', blockId)

    if (currentValue !== storeValue) {
      // If we got a replacement or null, update the field
      if (currentValue) {
        // Replacement found - update to new reference
        subBlockStore.setValue(blockId, subBlockId, currentValue)
      }
    }
  }
}

/**
 * Helper to store API key values
 */
function storeApiKeyValue(
  blockId: string,
  blockType: string | undefined,
  modelValue: string | null | undefined,
  newValue: any,
  storeValue: any
) {
  if (!blockType) return

  const subBlockStore = useSubBlockStore.getState()

  // Check if this is user explicitly clearing a field that had a value
  // We only want to mark it as cleared if it's a user action, not an automatic
  // clearing from model switching
  if (
    storeValue &&
    storeValue !== '' &&
    (newValue === null || newValue === '' || String(newValue).trim() === '')
  ) {
    // Mark this specific instance as cleared so we don't auto-fill it
    subBlockStore.markParamAsCleared(blockId, 'apiKey')
    return
  }

  // Only store non-empty values
  if (!newValue || String(newValue).trim() === '') return

  // If user enters a value, we should clear any "cleared" flag
  // to ensure auto-fill will work in the future
  if (subBlockStore.isParamCleared(blockId, 'apiKey')) {
    subBlockStore.unmarkParamAsCleared(blockId, 'apiKey')
  }

  // For provider-based blocks, store the API key under the provider name
  if ((blockType === 'agent' || blockType === 'router' || blockType === 'evaluator') && modelValue) {
    const provider = getProviderFromModel(modelValue)
    if (provider && provider !== 'ollama') {
      subBlockStore.setToolParam(provider, 'apiKey', String(newValue))
    }
  } else {
    // For other blocks, store under the block type
    subBlockStore.setToolParam(blockType, 'apiKey', String(newValue))
  }
}

/**
 * Custom hook to get and set values for a sub-block in a workflow.
 * Handles complex object values properly by using deep equality comparison.
 *
 * @param blockId The ID of the block containing the sub-block
 * @param subBlockId The ID of the sub-block
 * @param triggerWorkflowUpdate Whether to trigger a workflow update when the value changes
 * @returns A tuple containing the current value and a setter function
 */
export function useSubBlockValue<T = any>(
  blockId: string,
  subBlockId: string,
  triggerWorkflowUpdate: boolean = false
): readonly [T | null, (value: T) => void] {
  const blockType = useWorkflowStore(
    useCallback((state) => state.blocks?.[blockId]?.type, [blockId])
  )

  const initialValue = useWorkflowStore(
    useCallback(
      (state) => state.blocks?.[blockId]?.subBlocks?.[subBlockId]?.value ?? null,
      [blockId, subBlockId]
    )
  )

  // Keep a ref to the latest value to prevent unnecessary re-renders
  const valueRef = useRef<T | null>(null)

  // Previous model reference for detecting model changes
  const prevModelRef = useRef<string | null>(null)

  // Get value from subblock store - always call this hook unconditionally
  const storeValue = useSubBlockStore(
    useCallback((state) => state.getValue(blockId, subBlockId), [blockId, subBlockId])
  )

  // Check if this is an API key field that could be auto-filled
  const isApiKey =
    subBlockId === 'apiKey' || (subBlockId?.toLowerCase().includes('apikey') ?? false)

  // Check if auto-fill environment variables is enabled - always call this hook unconditionally
  const isAutoFillEnvVarsEnabled = useGeneralStore((state) => state.isAutoFillEnvVarsEnabled)

  // Always call this hook unconditionally - don't wrap it in a condition
  const modelSubBlockValue = useSubBlockStore((state) =>
    blockId ? state.getValue(blockId, 'model') : null
  )

  // Determine if this is a provider-based block type
  const isProviderBasedBlock = blockType === 'agent' || blockType === 'router' || blockType === 'evaluator'

  // Compute the modelValue based on block type
  const modelValue = isProviderBasedBlock ? (modelSubBlockValue as string) : null

  // Hook to set a value in the subblock store
  const setValue = useCallback(
    (newValue: T) => {
      // Use deep comparison to avoid unnecessary updates for complex objects
      if (!isEqual(valueRef.current, newValue)) {
        valueRef.current = newValue

        // Ensure we're passing the actual value, not a reference that might change
        const valueCopy =
          newValue === null
            ? null
            : typeof newValue === 'object'
              ? JSON.parse(JSON.stringify(newValue))
              : newValue

        // Handle API key storage for reuse across blocks
        if (isApiKey && blockType) {
          storeApiKeyValue(blockId, blockType, modelValue, newValue, storeValue)
        }

        // Update the subblock store with the new value
        // The store's setValue method will now trigger the debounced sync automatically
        useSubBlockStore.getState().setValue(blockId, subBlockId, valueCopy)

        if (triggerWorkflowUpdate) {
          useWorkflowStore.getState().triggerUpdate()
        }
      }
    },
    [blockId, subBlockId, blockType, isApiKey, storeValue, triggerWorkflowUpdate, modelValue]
  )

  // Initialize valueRef on first render
  useEffect(() => {
    valueRef.current = storeValue !== undefined ? storeValue : initialValue
  }, [])

  // When component mounts, check for existing API key in toolParamsStore
  useEffect(() => {
    // Skip autofill if the feature is disabled in settings
    if (!isAutoFillEnvVarsEnabled) return

    // Only process API key fields
    if (!isApiKey) return

    // Handle different block types
    if (isProviderBasedBlock) {
      handleProviderBasedApiKey(blockId, subBlockId, modelValue, storeValue)
    } else {
      // Normal handling for non-provider blocks
      handleStandardBlockApiKey(blockId, subBlockId, blockType, storeValue)
    }
  }, [blockId, subBlockId, blockType, storeValue, isApiKey, isAutoFillEnvVarsEnabled, modelValue, isProviderBasedBlock])

  // Monitor for model changes in provider-based blocks
  useEffect(() => {
    // Only process API key fields in model-based blocks
    if (!isApiKey || !isProviderBasedBlock) return

    // Check if the model has changed
    if (modelValue !== prevModelRef.current) {
      // Update the previous model reference
      prevModelRef.current = modelValue

      // For provider-based blocks, always clear the field if needed
      // But only fill with saved values if auto-fill is enabled
      if (modelValue) {
        const provider = getProviderFromModel(modelValue)

        // Skip if we couldn't determine a provider
        if (!provider || provider === 'ollama') return

        const subBlockStore = useSubBlockStore.getState()

        // Check if there's a saved value for this provider
        const savedValue = subBlockStore.resolveToolParamValue(provider, 'apiKey', blockId)

        if (savedValue && savedValue !== '' && isAutoFillEnvVarsEnabled) {
          // Only auto-fill if the feature is enabled
          subBlockStore.setValue(blockId, subBlockId, savedValue)
        } else {
          // Always clear immediately when switching to a model with no saved key
          // or when auto-fill is disabled
          subBlockStore.setValue(blockId, subBlockId, '')
        }
      }
    }
  }, [blockId, subBlockId, blockType, isApiKey, modelValue, isAutoFillEnvVarsEnabled, storeValue, isProviderBasedBlock])

  // Update the ref if the store value changes
  // This ensures we're always working with the latest value
  useEffect(() => {
    // Use deep comparison for objects to prevent unnecessary updates
    if (!isEqual(valueRef.current, storeValue)) {
      valueRef.current = storeValue !== undefined ? storeValue : initialValue
    }
  }, [storeValue, initialValue])

  return [valueRef.current as T | null, setValue] as const
}
