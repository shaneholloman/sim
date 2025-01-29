'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Search, PanelRightClose, PanelRight } from 'lucide-react'
import { ToolbarTabs } from './components/toolbar-tabs/toolbar-tabs'
import { ToolbarBlock } from './components/toolbar-block/toolbar-block'
import { getBlocksByCategory, getAllBlocks } from '../../../../blocks'
import { BlockCategory, BlockConfig } from '../../../../blocks/types'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function Toolbar() {
  const [activeTab, setActiveTab] = useState<BlockCategory>('basic')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)

  const blocks = useMemo(() => {
    if (!searchQuery.trim()) {
      return getBlocksByCategory(activeTab)
    }

    const query = searchQuery.toLowerCase()
    return getAllBlocks().filter(
      (block) =>
        block.toolbar.title.toLowerCase().includes(query) ||
        block.toolbar.description.toLowerCase().includes(query)
    )
  }, [searchQuery, activeTab])

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsCollapsed(false)}
            className="fixed left-20 bottom-[18px] z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted-foreground transition-colors hover:text-foreground hover:bg-accent border"
          >
            <PanelRight className="h-5 w-5" />
            <span className="sr-only">Open Toolbar</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Open Toolbar</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="fixed left-14 top-16 z-10 h-[calc(100vh-4rem)] overflow-y-auto w-64 border-r bg-background sm:block">
      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-[50%] h-4 w-4 -translate-y-[50%] text-muted-foreground" />
          <Input
            placeholder="Search blocks..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {!searchQuery && (
        <ToolbarTabs activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      <div className="p-4">
        <div className="flex flex-col gap-3">
          {blocks.map((block) => (
            <ToolbarBlock key={block.type} config={block} />
          ))}
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsCollapsed(true)}
            className="absolute right-4 bottom-5 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            <PanelRightClose className="h-5 w-5" />
            <span className="sr-only">Close Toolbar</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Close Toolbar</TooltipContent>
      </Tooltip>
    </div>
  )
}
