"use client";

import * as React from "react";
import {
  Card,
  Button,
  Tabs,
  Input,
  Dialog,
} from "@playora/ui";
import { UserPlus, Search, Users, UserCheck } from "lucide-react";

interface FriendItem {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: "online" | "in_game" | "offline";
  activity?: string;
}

export default function FriendsPage() {
  const [activeTab, setActiveTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [friendUsername, setFriendUsername] = React.useState("");

  // Real friends list (empty initially until players add friends)
  const [friends] = React.useState<FriendItem[]>([]);

  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-8 border-b border-border gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Friends & Social
          </h1>
          <p className="mt-2 text-muted-foreground">
            Connect with friends, check online presence, and send game invites.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-primary/20">
          <UserPlus className="h-4 w-4" />
          <span>Add Friend</span>
        </Button>
      </div>

      <div className="my-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs
          tabs={[
            { id: "all", label: "All Friends", count: friends.length },
            { id: "online", label: "Online", count: 0 },
            { id: "requests", label: "Pending Invites", count: 0 },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter friends..."
            className="pl-9 h-9 bg-card/60 border-border"
          />
        </div>
      </div>

      {filteredFriends.length === 0 ? (
        <Card className="bg-card/40 border-border/80 p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
            <Users className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-xl font-bold text-foreground">No Friends Added Yet</h3>
            <p className="text-sm text-muted-foreground">
              Add friends using their username or player tag to invite them to live multiplayer matches.
            </p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-primary/30">
            <UserPlus className="h-4 w-4" />
            <span>Add First Friend</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFriends.map((friend) => (
            <Card key={friend.id} className="hover:border-border transition-all">
              {/* Render friend item */}
            </Card>
          ))}
        </div>
      )}

      {/* Add Friend Dialog */}
      <Dialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Send Friend Invite"
        description="Enter the exact username or player ID."
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground">Username or ID</label>
            <Input
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              placeholder="e.g. Alex_Pro"
              className="mt-1 bg-card border-border"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsAddOpen(false);
                setFriendUsername("");
              }}
              className="gap-1.5 shadow-primary/30"
            >
              <UserCheck className="h-4 w-4" />
              <span>Send Request</span>
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
