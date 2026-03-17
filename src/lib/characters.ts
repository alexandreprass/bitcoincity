// All available character models
export const CHARACTER_LIST = [
  { id: 'adventurer', name: 'Adventurer', file: 'Adventurer.glb' },
  { id: 'astronaut', name: 'Astronaut', file: 'Astronaut.glb' },
  { id: 'beach', name: 'Beach Character', file: 'BeachCharacter.glb' },
  { id: 'business', name: 'Business Man', file: 'BusinessMan.glb' },
  { id: 'casual', name: 'Casual Character', file: 'CasualCharacter.glb' },
  { id: 'farmer', name: 'Farmer', file: 'Farmer.glb' },
  { id: 'hoodie', name: 'Hoodie Character', file: 'HoodieCharacter.glb' },
  { id: 'king', name: 'King', file: 'King.glb' },
  { id: 'punk', name: 'Punk', file: 'Punk.glb' },
  { id: 'swat', name: 'Swat', file: 'Swat.glb' },
  { id: 'worker', name: 'Worker', file: 'Worker.glb' },
] as const

export type CharacterId = typeof CHARACTER_LIST[number]['id']

export function getRandomCharacterId(): CharacterId {
  const idx = Math.floor(Math.random() * CHARACTER_LIST.length)
  return CHARACTER_LIST[idx].id
}

export function getCharacterFile(id: string): string {
  const char = CHARACTER_LIST.find(c => c.id === id)
  return `/models/characters/${char?.file || 'Adventurer.glb'}`
}

export function getCharacterName(id: string): string {
  const char = CHARACTER_LIST.find(c => c.id === id)
  return char?.name || 'Adventurer'
}
