import type { EconomyData } from "./economy";
import type { Profile, Member, Apartment, Building, Message, Poll, GameEvent, Activity, Announcement, Vote, Block, Transaction } from "./api";
export type Data = EconomyData & {
    profiles: Profile[];
    memberships: Member[];
    apartments: Apartment[];
    buildings: Building[];
    messages: Message[];
    polls: Poll[];
    events: GameEvent[];
    activity: Activity[];
    announcements: Announcement[];
    votes: Vote[];
    blocks: Block[];
    treasury_transactions: Transaction[];
};
