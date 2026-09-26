export type Creator = {
    name: string;
    username: string;
    image: string;
    rating: number;
    price: string;
    change: number;
    description: string;
    reviewsCount?: number;
    responseRate?: string;
    category?: string;
};

export const creatorImages = [
    "https://pbs.twimg.com/profile_images/2075257710715781123/74AtQPd6_400x400.jpg",
    "https://pbs.twimg.com/profile_images/1984256809427955712/H9T9bSeV_400x400.jpg",
    "https://pbs.twimg.com/profile_images/1773988714462461952/woSArAj4_400x400.jpg",
    "https://pbs.twimg.com/profile_images/1744808919518822400/tYvudcDg_400x400.jpg",
    "https://pbs.twimg.com/profile_images/1984019963955527680/EHTsBrCQ_400x400.jpg",
    "https://pbs.twimg.com/profile_images/1975912876243095552/YlVLO4Oz_400x400.jpg",
    "https://pbs.twimg.com/profile_images/2063909240755159040/tDvFMTN-_400x400.jpg",
];

export const creators: Creator[] = [
    {
        name: "Satoru Nakamoto",
        username: "satoru",
        image: creatorImages[0],
        rating: 4.98,
        price: "$14.50",
        change: 18.25,
        description: "Autonomous AI agent architect & open-source contributor.",
        reviewsCount: 142,
        responseRate: "99%",
        category: "AI & Engineering",
    },
    {
        name: "Elena Rostova",
        username: "elena_ux",
        image: creatorImages[1],
        rating: 4.95,
        price: "$8.75",
        change: 9.4,
        description: "Principal product designer shaping spatial interfaces.",
        reviewsCount: 98,
        responseRate: "97%",
        category: "Design",
    },
    {
        name: "Marcus Vance",
        username: "mvance",
        image: creatorImages[2],
        rating: 4.91,
        price: "$19.00",
        change: -3.12,
        description: "Early-stage investor backing decentralized systems.",
        reviewsCount: 76,
        responseRate: "94%",
        category: "Investing",
    },
    {
        name: "Aria Sterling",
        username: "ariasterling",
        image: creatorImages[3],
        rating: 4.89,
        price: "$6.20",
        change: 24.15,
        description:
            "Electronic music producer, audio engineer, and sound artist.",
        reviewsCount: 115,
        responseRate: "98%",
        category: "Music",
    },
    {
        name: "Kenji Sato",
        username: "kenji_sol",
        image: creatorImages[4],
        rating: 4.97,
        price: "$12.00",
        change: 6.8,
        description:
            "Solana core dev and high-frequency trading protocol engineer.",
        reviewsCount: 88,
        responseRate: "96%",
        category: "Solana",
    },
    {
        name: "Chloe Chen",
        username: "chloec",
        image: creatorImages[2],
        rating: 4.93,
        price: "$10.50",
        change: 12.3,
        description:
            "Creative director & growth strategist for next-gen consumer apps.",
        reviewsCount: 63,
        responseRate: "95%",
        category: "Marketing",
    },
];

export function getCreatorByUsername(username: string): Creator | undefined {
    if (!username) return undefined;
    const clean = decodeURIComponent(username).replace(/^@/, "").toLowerCase();
    return creators.find(
        (c) => c.username.replace(/^@/, "").toLowerCase() === clean
    );
}

export function getAllCreators(): Creator[] {
    return creators;
}
