import { clone } from 'ramda'
import * as Y from 'yjs'
import { v4 as uuidv4 } from 'uuid'
import prisma, {
  Document,
  PrismaTransaction,
  YjsAppDocument,
} from '@briefer/database'
import { IOServer } from '../../websocket/index.js'
import {
  YBlock,
  YBlockGroup,
  addDashboardItemToYDashboard,
  cloneBlockGroup,
  duplicateBlock,
  getDashboard,
  getDashboardItem,
  getDataframes,
  getLayout,
  switchBlockType,
} from '@briefer/editor'
import { AppPersistor, DocumentPersistor } from './persistors.js'
import { WSSharedDocV2, getDocId, getYDocForUpdate } from './index.js'

function duplicateYDoc(
  prevYDoc: WSSharedDocV2,
  newYDoc: Y.Doc,
  getDuplicatedTitle: (title: string) => string,
  config: { keepIds: boolean; datasourceMap?: Map<string, string> }
) {
  newYDoc.transact(
    () => {
      // map of old id to new id
      const idMap = new Map<string, string>()

      // duplicate title
      const newTitle = getDuplicatedTitle(prevYDoc.getTitleFromDoc())

      const titleFrag = newYDoc.getXmlFragment('title')
      titleFrag.delete(0, titleFrag.length)
      const titleEl = new Y.XmlElement('title')
      const titleText = new Y.XmlText(newTitle)
      titleEl.insert(0, [titleText])
      titleFrag.insert(0, [titleEl])

      // duplicate blocks
      const oldBlocksMap = prevYDoc.blocks
      const newBlocksMap = newYDoc.getMap<YBlock>('blocks')
      newBlocksMap.clear()

      for (const [blockId, block] of oldBlocksMap.entries()) {
        const newBlockId = config.keepIds ? blockId : uuidv4()
        idMap.set(blockId, newBlockId)
        const blockType = block.getAttribute('type')
        if (blockType) {
          const clonedBlock = duplicateBlock(
            newBlockId,
            block,
            prevYDoc.blocks,
            true,
            { datasourceMap: config.datasourceMap }
          )
          newBlocksMap.set(newBlockId, clonedBlock)
        }
      }

      // duplicate layout
      const prevLayout = prevYDoc.layout
      const newLayout = getLayout(newYDoc)
      newLayout.delete(0, newLayout.length)
      const newLayoutArr: YBlockGroup[] = prevLayout.map(cloneBlockGroup)
      newLayout.insert(0, newLayoutArr)

      // translate layout ids
      if (!config.keepIds) {
        newLayout.forEach((newBlockGroup) => {
          newBlockGroup.getAttribute('tabs')?.forEach((tab) => {
            const oldId = tab.getAttribute('id')
            if (oldId) {
              const translatedId = idMap.get(oldId)
              tab.setAttribute('id', translatedId ?? uuidv4())
            }
          })
          const currentRef = newBlockGroup.getAttribute('current')
          if (currentRef) {
            const oldId = currentRef.getAttribute('id')
            if (!oldId) {
              throw new Error('Tab id not found')
            }
            const translatedId = idMap.get(oldId)
            currentRef.setAttribute('id', translatedId ?? uuidv4())
          }

          newLayoutArr.push(newBlockGroup)
        })
      }

      const prevDashboard = prevYDoc.dashboard

      const newDashboard = getDashboard(newYDoc)
      newDashboard.clear()

      for (const dashId of prevDashboard.keys()) {
        const dashItem = getDashboardItem(prevDashboard, dashId)
        if (!dashItem) {
          continue
        }

        const oldId = dashItem.blockId
        const newId = idMap.get(oldId)
        if (!newId) {
          continue
        }

        dashItem.blockId = newId
        addDashboardItemToYDashboard(newDashboard, dashItem)
      }

      // duplicate dataframes
      const prevDataframes = prevYDoc.dataframes
      const newDataframes = getDataframes(newYDoc)
      newDataframes.clear()

      for (const [dataframeId, dataframe] of prevDataframes.entries()) {
        newDataframes.set(dataframeId, clone(dataframe))
      }
    },
    { isDuplicating: true }
  )
}

export function getYDocWithoutHistory(ydoc: WSSharedDocV2): Y.Doc {
  const newDoc = new Y.Doc()
  duplicateYDoc(ydoc, newDoc, (title) => title, { keepIds: true })
  return newDoc
}

export async function duplicateDocument(
  socketServer: IOServer,
  prevDoc: Document,
  newDoc: Document,
  getDuplicatedTitle: (title: string) => string,
  tx: PrismaTransaction,
  datasourceMap?: Map<string, string>
) {
  const prevId = getDocId(prevDoc.id, null)
  await getYDocForUpdate(
    prevId,
    socketServer,
    prevDoc.id,
    prevDoc.workspaceId,
    async (existingYDoc) => {
      const newId = getDocId(newDoc.id, null)
      await getYDocForUpdate(
        newId,
        socketServer,
        newDoc.id,
        newDoc.workspaceId,
        async (newYDoc) => {
          duplicateYDoc(existingYDoc, newYDoc.ydoc, getDuplicatedTitle, {
            keepIds: false,
            datasourceMap,
          })

          const blocks = newYDoc.blocks
          const componentInstances: {
            blockId: string
            componentId: string
          }[] = []
          for (const [blockId, block] of blocks) {
            const componentId = switchBlockType(block, {
              onSQL: (block) => block.getAttribute('componentId'),
              onPython: (block) => block.getAttribute('componentId'),
              onRichText: () => null,
              onVisualization: () => null,
              onVisualizationV2: () => null,
              onInput: () => null,
              onDropdownInput: () => null,
              onDateInput: () => null,
              onFileUpload: () => null,
              onDashboardHeader: () => null,
              onWriteback: () => null,
              onPivotTable: () => null,
            })

            if (componentId) {
              componentInstances.push({ blockId, componentId })
            }
          }

          if (componentInstances.length > 0) {
            await tx.reusableComponentInstance.createMany({
              data: componentInstances.map((ci) => ({
                blockId: ci.blockId,
                reusableComponentId: ci.componentId,
                documentId: newDoc.id,
              })),
              skipDuplicates: true,
            })
          }
        },
        new DocumentPersistor(newId, newDoc.id),
        tx
      )
    },
    new DocumentPersistor(prevId, prevDoc.id),
    tx
  )
}

export async function updateAppState(
  ydoc: WSSharedDocV2,
  app: YjsAppDocument,
  socketServer: IOServer
) {
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc.ydoc))
  const usersApps = await prisma().userYjsAppDocument.findMany({
    where: { yjsAppDocumentId: app.id },
    select: { userId: true },
  })
  await Promise.all(
    usersApps.map(async (userApp) => {
      const docId = getDocId(app.documentId, {
        id: app.id,
        userId: userApp.userId,
      })
      return getYDocForUpdate(
        docId,
        socketServer,
        app.documentId,
        ydoc.workspaceId,
        (ydoc) => ydoc.replaceState(state),
        new AppPersistor(docId, app.id, userApp.userId)
      )
    })
  )
}
