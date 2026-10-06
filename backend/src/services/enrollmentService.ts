import mongoose from 'mongoose';
import Game from '../models/Game';
import PlayerGame from '../models/PlayerGame';
import User from '../models/User';

/**
 * Ensures a player is automatically enrolled in all currently active/open games.
 * Safe to call multiple times (idempotent).
 */
export async function autoEnrollPlayerInActiveGames(userId: string | mongoose.Types.ObjectId): Promise<void> {
  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'player' || !user.isActive) return;

    const activeGames = await Game.find({ status: { $in: ['ACTIVE', 'DRAFT', 'PAUSED'] } });
    for (const game of activeGames) {
      const existing = await PlayerGame.findOne({ userId: user._id, gameId: game._id });
      if (!existing) {
        await new PlayerGame({
          userId: user._id,
          gameId: game._id,
          status: 'ACTIVE',
        }).save();
        await Game.findByIdAndUpdate(game._id, { $inc: { totalPlayers: 1 } });
      }
    }
  } catch (err) {
    console.error('Error auto-enrolling player in active games:', err);
  }
}

/**
 * Ensures all existing active players are enrolled in a specific game.
 * Used when a new game is created or seeded.
 */
export async function autoEnrollAllActivePlayersInGame(gameId: string | mongoose.Types.ObjectId): Promise<number> {
  try {
    const game = await Game.findById(gameId);
    if (!game) return 0;

    const players = await User.find({ role: 'player', isActive: true });
    let newlyEnrolled = 0;

    for (const player of players) {
      const existing = await PlayerGame.findOne({ userId: player._id, gameId: game._id });
      if (!existing) {
        await new PlayerGame({
          userId: player._id,
          gameId: game._id,
          status: 'ACTIVE',
        }).save();
        newlyEnrolled++;
      }
    }

    if (newlyEnrolled > 0) {
      await Game.findByIdAndUpdate(game._id, { $inc: { totalPlayers: newlyEnrolled } });
    }
    return newlyEnrolled;
  } catch (err) {
    console.error('Error auto-enrolling all active players in game:', err);
    return 0;
  }
}
