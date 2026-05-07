import { getGameContent, getChildProfile } from "../../../../api/content";

async function test() {
  console.log("Testing content API...");
  
  const profile = await getChildProfile("Idriszhon");
  console.log("Child profile:", JSON.stringify(profile, null, 2));
  
  const animals = await getGameContent("matching", "ru", 5, 6);
  console.log(`\nAnimals for matching (${animals.length} items):`);
  animals.forEach(a => console.log(`  ${a.emoji} ${a.word}`));
  
  const numbers = await getGameContent("counting", "ru", 5, 5);
  console.log(`\nNumbers for counting (${numbers.length} items):`);
  numbers.forEach(n => console.log(`  ${n.emoji} ${n.word}`));
}

test().catch(console.error);