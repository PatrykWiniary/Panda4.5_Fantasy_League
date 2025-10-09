export interface Room {
    id: number
}

export interface Card {
    name: string,
    points: number,
    value: number,
    multiplier?: "Captain" | "Vice-captain"
    role: "Mid" | "Top" | "Jgl" | "Adc" | "Supp"
}

export interface Deck {
    cards?: Card[]
}

export interface User {
    name: string,
    mail: string,
    password: string
    currency: number
    //deck: Deck
}