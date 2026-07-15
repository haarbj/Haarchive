export type FamilyTreeNode = {
  name: string;
  slug?: string;
  // A secondary influence on this node that doesn't get its own branch
  // position -- this is a tree, not a full influence graph, so a node with
  // two real predecessors (Tom Schwartz draws on both Lydiard and Daniels)
  // is placed under its primary influence and the second is annotated
  // inline instead of drawn as a second parent edge.
  alsoInfluencedBy?: string[];
  children?: FamilyTreeNode[];
};

// One shared, whole-library family tree -- the per-coach Genealogy section
// on each coach's own page answers "who influenced this one coach"; this
// answers "how do all seven relate to each other," which only makes sense
// drawn once, not seven times. Every edge here is pulled directly from the
// same `influencedBy` facts already in each coach's own data.ts entry --
// this file doesn't introduce any new claim, just draws the existing ones
// as one connected picture. Real gaps are left as separate roots (Canova,
// Daniels, Pfitzinger, and the Norwegian System's own pre-coach-page
// lineage) rather than forced into a single all-connected tree that isn't
// historically accurate.
export const FAMILY_FOREST: FamilyTreeNode[] = [
  {
    name: "Arthur Lydiard",
    slug: "lydiard",
    children: [
      { name: "Joe Vigil", slug: "vigil" },
      {
        name: "Tom Schwartz",
        slug: "tom-schwartz",
        alsoInfluencedBy: ["Jack Daniels"],
      },
      { name: "Modern aerobic-base coaching broadly" },
    ],
  },
  {
    name: "Jack Daniels",
    slug: "daniels",
  },
  {
    name: "Renato Canova",
    slug: "canova",
  },
  {
    name: "Bill Squires",
    children: [{ name: "Pete Pfitzinger", slug: "pfitzinger" }],
  },
  {
    name: "Peter Coe",
    children: [
      {
        name: "Marius Bakken",
        children: [
          {
            name: "Gjert Ingebrigtsen",
            children: [{ name: "Norwegian System", slug: "norwegian-system" }],
          },
        ],
      },
    ],
  },
];
