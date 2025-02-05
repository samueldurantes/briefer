import useDropdownPosition from '@/hooks/dropdownPosition'
import { Menu, Transition } from '@headlessui/react'
import { EyeIcon } from '@heroicons/react/20/solid'
import {
  CodeBracketIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline'
import { BookUpIcon } from 'lucide-react'
import { useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: () => void
  hasMultipleTabs: boolean
  isCodeHidden: boolean
  onToggleIsCodeHidden?: () => void
  isOutputHidden: boolean
  onToggleIsOutputHidden?: () => void
}
function HiddenInPublishedButton(props: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { onOpen, dropdownPosition, containerRef } = useDropdownPosition(
    buttonRef,
    'top'
  )

  return (
    <Menu as="div" className="inline-block">
      {() => {
        return (
          <>
            <Menu.Button
              ref={buttonRef}
              onClick={onOpen}
              className="rounded-sm border border-gray-200 h-6 min-w-6 flex items-center justify-center relative group hover:bg-gray-50"
            >
              <EyeIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-500" />
            </Menu.Button>
            {createPortal(
              <Transition
                as="div"
                className="absolute z-30"
                enter="transition-opacity duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition-opacity duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                style={{
                  top: dropdownPosition.top,
                  right:
                    dropdownPosition.right +
                    (buttonRef.current?.getBoundingClientRect().width ?? 0) +
                    4,
                }}
              >
                <Menu.Items
                  as="div"
                  ref={containerRef}
                  className="absolute z-30 -translate-x-full rounded-md bg-white shadow-[0_4px_12px_#CFCFCF] ring-1 ring-gray-100 focus:outline-none font-sans divide-y divide-gray-200 flex flex-col text-xs text-gray-600"
                >
                  <div className="flex flex-col divide-y divide-gray-200">
                    <div className="py-0.5 px-0.5">
                      <Menu.Item
                        as="button"
                        onClick={props.onToggleIsBlockHiddenInPublished}
                        className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                      >
                        <BookUpIcon className="w-4 h-4 " />
                        <span>
                          {props.isBlockHiddenInPublished ? 'Show' : 'Hide'} in
                          saved version
                        </span>
                      </Menu.Item>
                      {props.onToggleIsCodeHidden && (
                        <Menu.Item
                          as="button"
                          onClick={props.onToggleIsCodeHidden}
                          className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                        >
                          <CodeBracketIcon className="h-4 w-4" />
                          <span>
                            {props.isCodeHidden ? 'Show' : 'Hide'} code
                          </span>
                        </Menu.Item>
                      )}
                      {props.onToggleIsOutputHidden && (
                        <Menu.Item
                          as="button"
                          onClick={props.onToggleIsOutputHidden}
                          className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                        >
                          <ComputerDesktopIcon className="h-4 w-4" />
                          <span>
                            {props.isOutputHidden ? 'Show' : 'Hide'} output
                          </span>
                        </Menu.Item>
                      )}
                    </div>
                  </div>
                </Menu.Items>
              </Transition>,
              document.body
            )}
          </>
        )
      }}
    </Menu>
  )
}

export default HiddenInPublishedButton
