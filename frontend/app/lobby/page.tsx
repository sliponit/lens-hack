"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import Image from "next/image";
import { getGroveUpload } from "../../utils/grove";
import { useUserData } from "../../hooks/useUserData";
import { useUserStore } from "../../store/userStore";
// import LensProfileCard from "../components/LensProfileCard";

// // Mock data for public games - replace with actual data from your backend
// const mockPublicGames = [
//   {
//     id: "abc123",
//     name: "Village Night",
//     players: 4,
//     maxPlayers: 8,
//     status: "waiting",
//   },
//   {
//     id: "def456",
//     name: "Wolf Pack",
//     players: 6,
//     maxPlayers: 10,
//     status: "waiting",
//   },
//   {
//     id: "ghi789",
//     name: "Mystery Manor",
//     players: 3,
//     maxPlayers: 8,
//     status: "waiting",
//   },
// ];

// Function to generate UUID
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function LobbyPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { isLoading: isUserDataLoading, error: userDataError } =
    useUserData(address);
  const { username, groveId, setUsername } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isLensProfileLoading, setIsLensProfileLoading] = useState(false);
  const [liveGames, setLiveGames] = useState<
    Array<{
      gameId: string;
      players: number;
      maxPlayers: number;
      status: string;
      createdAt: string;
    }>
  >([]);
  const [lensProfile, setLensProfile] = useState<{
    handle: string;
    picture: string;
  } | null>(null);
  const [gameStatus, setGameStatus] = useState<{
    hasActiveGame: boolean;
    gameId: string | null;
    availableSlots: number;
  }>({
    hasActiveGame: false,
    gameId: null,
    availableSlots: 0,
  });
  const [customUsername, setCustomUsername] = useState("");

  useEffect(() => {
    if (isConnected && address) {
      checkGameStatus();
      fetchLiveGames();
      if (!username) {
        fetchLensProfile();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, username]);

  const fetchLensProfile = async () => {
    if (!address) return;
    setIsLensProfileLoading(true);
    try {
      const response = await fetch(
        `https://api.web3.bio/profile/lens/${address}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      console.log(data, "data");

      if (!response.ok) {
        console.error("Error fetching profile:", data.error);
        return;
      }

      if (data.identity) {
        setLensProfile({
          handle: data.identity,
          picture: data.avatar,
        });
        console.log(lensProfile, "lensProfile");
      } else {
        console.log("No Lens profile found for this address");
      }
    } catch (error) {
      console.error("Error fetching Lens profile:", error);
    } finally {
      setIsLensProfileLoading(false);
    }
  };

  const fetchLiveGames = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/live`
      );
      const data = await response.json();
      if (data.games) {
        setLiveGames(data.games);
      }
    } catch (error) {
      console.error("Error fetching live games:", error);
    }
  };

  const handleCreatePlayerAccount = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      // First create Grove ID
      const groveResponse = await getGroveUpload(address);

      if (groveResponse) {
        // Save user data to server
        const saveResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              address,
              groveId: groveResponse,
              username: lensProfile ? lensProfile.handle : customUsername,
              avatar: lensProfile ? lensProfile.picture : "/person.png",
            }),
          }
        );

        const saveData = await saveResponse.json();
        if (saveData.success) {
          setUsername(lensProfile ? lensProfile.handle : customUsername);
          console.log("Player account created successfully");
        }
      }
    } catch (error) {
      console.error("Error creating player account:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkGameStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/status`
      );
      const data = await response.json();

      setGameStatus({
        hasActiveGame: data.hasActiveGame,
        gameId: data.gameId,
        availableSlots: data.availableSlots,
      });

      if (data.hasActiveGame && data.availableSlots > 0) {
        handleJoinGame(data.gameId);
      }
    } catch (error) {
      console.error("Error checking game status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGame = async () => {
    setIsLoading(true);
    try {
      // First check if there's an existing game
      const statusResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/status`
      );
      const statusData = await statusResponse.json();

      if (statusData.hasActiveGame) {
        // If there's an active game, try to join it
        const joinResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ gameId: statusData.gameId, address }),
          }
        );
        const joinData = await joinResponse.json();

        if (joinData.success) {
          router.push(`/game/${statusData.gameId}`);
          return;
        }
      }

      // If no active game or couldn't join, create a new game
      const newGameId = generateUUID();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address, gameId: newGameId, groveId }),
        }
      );
      const data = await response.json();

      if (data.gameId) {
        router.push(`/game/${data.gameId}`);
      }
    } catch (error) {
      console.error("Error handling game creation/joining:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    setIsLoading(true);
    try {
      if (!address || !groveId) {
        console.error("Address or Grove ID is missing");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gameId,
            address,
            groveId,
            username,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        console.error("Error joining game:", data.error);
        return;
      }

      if (data.newUuid) {
        // Store the player's UUID in localStorage or state management
        localStorage.setItem("playerUuid", data.newUuid);
        // Redirect to the game page
        router.push(`/game/${gameId}`);
      }
    } catch (error) {
      console.error("Error joining game:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroveCreate = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const groveResponse = await getGroveUpload(address);

      if (groveResponse) {
        // Save grove ID to server
        const saveResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/grove/save`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              address,
              groveId: groveResponse,
            }),
          }
        );

        const saveData = await saveResponse.json();
        if (saveData.success) {
          console.log("Grove created successfully:", groveResponse);
        }
      }
    } catch (error) {
      console.error("Error creating grove:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF5E6] text-[#4A4A4A] p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-[#8B7355]">
          Game Lobby
        </h1>

        <div className="wallet-section mb-8 flex justify-center">
          <ConnectKitButton />
        </div>

        <div className="flex justify-center items-center min-h-[80vh]">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border-4 border-[#EADBC8] p-8 relative overflow-hidden">
            {/* Loading overlay */}
            {(isUserDataLoading || isLoading) && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-3xl">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#8B7355]"></div>
              </div>
            )}

            {/* Error message */}
            {userDataError && (
              <div className="text-red-500 text-center mb-4">
                {userDataError}
              </div>
            )}

            {/* Profile or No Profile */}
            {username ? (
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <Image
                    src="/person.png"
                    alt={username}
                    className="w-24 h-24 rounded-full border-4 border-[#8B7355] bg-[#FFF5E6] object-cover shadow"
                    width={96}
                    height={96}
                  />
                  <Image
                    src="/lens.jpeg"
                    alt="Lens Logo"
                    className="absolute -bottom-3 -right-3 w-10 h-10 bg-white rounded-full border-2 border-[#EADBC8] p-1"
                    width={40}
                    height={40}
                  />
                </div>
                <h2 className="text-3xl font-extrabold text-[#8B7355] mb-1">
                  {username}
                </h2>
                <p className="text-[#6B5B4E] mb-4">
                  Welcome to Lens Game Lobby!
                </p>
                <hr className="w-2/3 border-[#EADBC8] my-4" />

                {/* Game Status */}
                {gameStatus.hasActiveGame ? (
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-[#8B7355] mb-2">
                      Active Game Found
                    </h3>
                    <p className="mb-4 text-[#6B5B4E]">
                      Available slots: {gameStatus.availableSlots}
                    </p>
                    <button
                      onClick={() => handleJoinGame(gameStatus.gameId!)}
                      className="bg-[#8B7355] hover:bg-[#6B5B4E] text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg"
                    >
                      Join Game
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-[#8B7355] mb-2">
                      No Active Games
                    </h3>
                    <p className="mb-4 text-[#6B5B4E]">
                      Create a new game and wait for others to join!
                    </p>
                    <div className="space-y-4">
                      {!groveId && (
                        <button
                          onClick={handleGroveCreate}
                          className="bg-[#8B7355] hover:bg-[#6B5B4E] text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg w-full"
                        >
                          Create Grove ID
                        </button>
                      )}
                      <button
                        onClick={handleCreateGame}
                        className="bg-[#8B7355] hover:bg-[#6B5B4E] text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg w-full"
                      >
                        Create New Game
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[350px]">
                <Image
                  src="/lens-logo.svg"
                  alt="Lens Logo"
                  width={96}
                  height={96}
                  className="w-24 h-24 mb-4 opacity-80"
                />
                {isLensProfileLoading ? (
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#8B7355]"></div>
                ) : lensProfile ? (
                  <>
                    <div className="text-5xl mb-2">🎮</div>
                    <h2 className="text-2xl font-bold text-[#8B7355] mb-2">
                      Welcome, {lensProfile.handle}!
                    </h2>
                    <p className="text-[#6B5B4E] mb-4">
                      Create your player account to start playing
                    </p>
                    <button
                      onClick={handleCreatePlayerAccount}
                      disabled={isLoading}
                      className="inline-block bg-[#8B7355] hover:bg-[#6B5B4E] text-white font-bold py-2 px-8 rounded-xl transition-colors shadow disabled:opacity-50"
                    >
                      {isLoading
                        ? "Creating Account..."
                        : "Create Player Account"}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-2">😢</div>
                    <h2 className="text-2xl font-bold text-[#8B7355] mb-2">
                      No Lens ID? No Problem!
                    </h2>
                    <p className="text-[#6B5B4E] mb-4">
                      Enter a username to start playing
                    </p>
                    <div className="w-full max-w-md space-y-4">
                      <input
                        type="text"
                        value={customUsername}
                        onChange={(e) => setCustomUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full px-4 py-2 rounded-lg border-2 border-[#EADBC8] focus:border-[#8B7355] focus:outline-none"
                      />
                      <button
                        onClick={handleCreatePlayerAccount}
                        disabled={isLoading || !customUsername.trim()}
                        className="w-full bg-[#8B7355] hover:bg-[#6B5B4E] text-white font-bold py-2 px-8 rounded-xl transition-colors shadow disabled:opacity-50"
                      >
                        {isLoading
                          ? "Creating Account..."
                          : "Create Player Account"}
                      </button>
                      <div className="text-center">
                        <p className="text-sm text-[#6B5B4E] mb-2">
                          Or get a Lens ID for more features:
                        </p>
                        <a
                          href="https://claim.lens.xyz"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#8B7355] hover:text-[#6B5B4E] underline"
                        >
                          Get Your Lens ID Now
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live Games Section */}
        {username && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-[#8B7355]">
              Live Games
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveGames.length > 0 ? (
                liveGames.map((game) => (
                  <div
                    key={game.gameId}
                    className="bg-white rounded-xl p-4 shadow-lg border-2 border-[#EADBC8] hover:border-[#8B7355] transition-colors"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-[#8B7355]">
                        Game #{game.gameId.slice(0, 8)}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-sm ${
                          game.status === "waiting"
                            ? "bg-yellow-100 text-yellow-800"
                            : game.status === "in_progress"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {game.status}
                      </span>
                    </div>
                    <div className="text-sm text-[#6B5B4E] mb-3">
                      <p>
                        Players: {game.players}/{game.maxPlayers}
                      </p>
                      <p>
                        Created: {new Date(game.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoinGame(game.gameId)}
                      disabled={game.players >= game.maxPlayers}
                      className="w-full bg-[#8B7355] hover:bg-[#6B5B4E] text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {game.players >= game.maxPlayers
                        ? "Game Full"
                        : "Join Game"}
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 bg-white rounded-xl border-2 border-[#EADBC8]">
                  <p className="text-[#6B5B4E]">No live games available</p>
                  <p className="text-sm text-[#8B7355] mt-2">
                    Create a new game to start playing!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Rules Section */}
        <div className="mt-8 bg-white p-6 rounded-lg border-2 border-[#D4C4B7] shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-[#8B7355]">
            Quick Rules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-[#8B7355]">
                Game Phases
              </h3>
              <ul className="list-disc list-inside text-[#6B5B4E] space-y-2">
                <li>
                  Night: Wolves hunt, Detective investigates, Doctor protects
                </li>
                <li>Day: Discuss and vote to eliminate suspicious players</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-[#8B7355]">
                Winning Conditions
              </h3>
              <ul className="list-disc list-inside text-[#6B5B4E] space-y-2">
                <li>Villagers win when all wolves are eliminated</li>
                <li>Wolves win when they equal or outnumber villagers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
