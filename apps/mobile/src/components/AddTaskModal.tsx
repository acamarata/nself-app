/**
 * Purpose: Modal for creating a new task — text input + validation + offline-aware save label.
 * Inputs:
 *   - visible: whether the modal is shown
 *   - listId: parent list ID (for validation context)
 *   - isOffline: drives the save button label ("Save (offline)" vs "Save")
 *   - onSave: callback with (title: string) — caller handles mutation/queue
 *   - onClose: dismiss the modal without saving
 * Outputs: Renders a sheet-style modal with a title input, validation error, and cancel/save actions.
 * Constraints:
 *   - Validates via taskCreateSchema before calling onSave.
 *   - accessibilityViewIsModal on the inner container.
 *   - autoFocus on input; maxLength=200.
 * SPORT: extracted from ListScreen.tsx P4-E0-W2-S07-T01
 */

import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { taskCreateSchema } from '../lib/validation';

interface AddTaskModalProps {
  visible: boolean;
  listId: string;
  isOffline: boolean;
  onSave: (title: string) => void;
  onClose: () => void;
}

/**
 * Sheet-style modal for composing a new task.
 * Validates on save; surfaces the first error message inline.
 */
export function AddTaskModal({
  visible,
  listId,
  isOffline,
  onSave,
  onClose,
}: AddTaskModalProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = () => {
    const validation = taskCreateSchema({ title, listId });
    if (!validation.success) {
      setValidationError(validation.errors?.[0]?.message ?? 'Invalid input');
      return;
    }
    onSave(validation.data!.title);
    setTitle('');
    setValidationError(null);
  };

  const handleClose = () => {
    setTitle('');
    setValidationError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal} accessibilityViewIsModal={true}>
          <Text style={styles.modalTitle}>New task</Text>
          <TextInput
            style={[styles.modalInput, !!validationError && styles.modalInputError]}
            value={title}
            onChangeText={(t) => { setTitle(t); setValidationError(null); }}
            placeholder="Task title"
            autoFocus
            maxLength={200}
            onSubmitEditing={handleSave}
            accessibilityLabel="Task title"
          />
          {!!validationError && (
            <Text style={styles.validationError}>{validationError}</Text>
          )}
          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel={isOffline ? 'Save task (queued for offline sync)' : 'Save task'}
            >
              <Text style={styles.modalSave}>
                {isOffline ? 'Save (offline)' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 32,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  modalInputError: {
    borderColor: '#dc2626',
  },
  validationError: {
    fontSize: 12,
    color: '#dc2626',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
    marginTop: 12,
  },
  modalCancel: {
    fontSize: 15,
    color: '#6b7280',
  },
  modalSave: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '700',
  },
});
