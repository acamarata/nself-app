/**
 * Purpose: Left-rail list/project switcher sidebar for ListView screen.
 * Inputs: lists (NpList[]), selectedListId, onSelectList
 * Outputs: Vertical scrollable list of focusable list items in a fixed-width sidebar.
 * Constraints:
 *   - Fixed width: 360px — leaves 1560px for task area on 1920px displays.
 *   - Items are 80px tall minimum for D-pad ergonomics.
 *   - Selected item uses brand color background; focused item gets the standard focus ring.
 *   - List icon (emoji or letter) shown to the left of the title.
 *   - No virtualization needed — a user won't have >100 lists; flat ScrollView is fine.
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { TVFocusable } from '../navigation/FocusContext'
import { tvTheme } from '../theme'
import type { NpList } from '@nself/ntask-core'

interface ListSidebarTVProps {
  lists: NpList[]
  selectedListId: string | null
  onSelectList: (listId: string) => void
  /** Focus id prefix — each item gets id `${idPrefix}-${index}` */
  idPrefix?: string
}

export function ListSidebarTV({
  lists,
  selectedListId,
  onSelectList,
  idPrefix = 'sidebar',
}: ListSidebarTVProps) {
  const { t } = useTranslation('screens')

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('sidebar.lists')}</Text>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {lists.map((list, index) => {
          const isSelected = list.id === selectedListId
          const focusId = `${idPrefix}-${index}`
          const nextUp = index > 0 ? `${idPrefix}-${index - 1}` : undefined
          const nextDown = index < lists.length - 1 ? `${idPrefix}-${index + 1}` : undefined

          return (
            <TVFocusable
              key={list.id}
              id={focusId}
              onSelect={() => onSelectList(list.id)}
              nextFocusUp={nextUp}
              nextFocusDown={nextDown}
              accessibilityLabel={list.title}
              style={[
                styles.item,
                isSelected ? styles.itemSelected : null,
              ]}
            >
              <View style={styles.itemContent}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: list.color || tvTheme.colors.brand },
                  ]}
                />
                <Text
                  style={[styles.itemText, isSelected && styles.itemTextSelected]}
                  numberOfLines={1}
                >
                  {list.title}
                </Text>
              </View>
            </TVFocusable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 360,
    backgroundColor: tvTheme.colors.surfaceSecondary,
    paddingVertical: tvTheme.spacing.lg,
    paddingHorizontal: tvTheme.spacing.md,
  },
  header: {
    fontSize: tvTheme.typeScale.caption,
    color: tvTheme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: tvTheme.spacing.md,
    paddingHorizontal: tvTheme.spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  item: {
    backgroundColor: 'transparent',
    borderRadius: tvTheme.radius.sm,
    paddingHorizontal: tvTheme.spacing.sm,
    paddingVertical: tvTheme.spacing.md,
    marginVertical: 4,
    minHeight: 80,
    justifyContent: 'center',
  },
  itemSelected: {
    backgroundColor: tvTheme.colors.brand + '22', // 13% opacity brand tint
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tvTheme.spacing.sm,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    flexShrink: 0,
  },
  itemText: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textSecondary,
    flex: 1,
  },
  itemTextSelected: {
    color: tvTheme.colors.brand,
    fontWeight: '600',
  },
})
