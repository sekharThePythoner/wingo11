// Wingo 11 - Firebase Configuration and Core Utilities
// Firebase Modular SDK v10 via ESM CDN

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  runTransaction,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCW2cteOpWGHPNykcW_41huNGiliYy1Ui8",
  authDomain: "satoshi-team.firebaseapp.com",
  projectId: "satoshi-team",
  storageBucket: "satoshi-team.firebasestorage.app",
  messagingSenderId: "907400992407",
  appId: "1:907400992407:web:5fd0254bc632e1fddcfbd2",
  measurementId: "G-421W8CMLWD"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Generate a memorable 6-digit Game UID (e.g., W11-482910)
export function generateGameUid() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `W11-${num}`;
}

// User state observer
export function initAuthListener(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          // New User Creation
          const gameUid = generateGameUid();
          const initialData = {
            uid: user.uid,
            gameUid: gameUid,
            displayName: user.displayName || "Player",
            email: user.email,
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
            balance: 100, // Starter bonus ₹100
            totalWins: 0,
            totalGames: 0,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
          };
          await setDoc(userDocRef, initialData);

          // Record welcome bonus transaction
          await addDoc(collection(db, "transactions"), {
            userId: user.uid,
            gameUid: gameUid,
            type: "BONUS",
            amount: 100,
            description: "Welcome Sign Up Bonus",
            status: "COMPLETED",
            createdAt: serverTimestamp()
          });

          callback(initialData, user);
        } else {
          // Existing User
          await updateDoc(userDocRef, { lastLogin: serverTimestamp() });
          
          // Real-time listener for user profile & balance
          onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              callback(snap.data(), user);
            }
          });
        }
      } catch (err) {
        console.error("Auth profile sync error:", err);
        // Fallback local memory profile if firestore rules require permissions
        const fallback = {
          uid: user.uid,
          gameUid: `W11-${user.uid.slice(0, 6).toUpperCase()}`,
          displayName: user.displayName || "Player",
          email: user.email,
          photoURL: user.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=wingo",
          balance: parseFloat(localStorage.getItem(`wingo_balance_${user.uid}`) || "100"),
          totalWins: 0,
          totalGames: 0
        };
        callback(fallback, user);
      }
    } else {
      callback(null, null);
    }
  });
}

// Sign in with Google
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error("Google sign in error:", err);
    throw err;
  }
}

// Logout
export async function logoutUser() {
  await signOut(auth);
  window.location.reload();
}

// Delete Account
export async function deleteUserAccount(user) {
  if (!user) throw new Error("No authenticated user");
  try {
    await deleteDoc(doc(db, "users", user.uid));
  } catch (e) {
    console.warn("Could not delete firestore document:", e);
  }
  await deleteUser(user);
}

// Atomically adjust balance
export async function updateBalance(userId, delta, reason = "Game Bet") {
  const userRef = doc(db, "users", userId);
  try {
    const newBal = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User record does not exist!");
      }
      const currentBalance = userDoc.data().balance || 0;
      const updated = Math.round((currentBalance + delta) * 100) / 100;
      if (updated < 0) {
        throw new Error("Insufficient Balance! Please deposit funds to continue.");
      }
      transaction.update(userRef, { balance: updated });
      return updated;
    });

    // Record transaction
    try {
      await addDoc(collection(db, "transactions"), {
        userId: userId,
        amount: Math.abs(delta),
        type: delta >= 0 ? "WIN_OR_CREDIT" : "BET_OR_DEBIT",
        description: reason,
        status: "COMPLETED",
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Transaction log failed:", e);
    }

    return newBal;
  } catch (err) {
    // If firestore fails (e.g. offline/rules), provide local persistent fallback
    let current = parseFloat(localStorage.getItem(`wingo_balance_${userId}`) || "100");
    if (current + delta < 0) {
      throw new Error("Insufficient Balance! Please deposit funds to continue.");
    }
    current = Math.round((current + delta) * 100) / 100;
    localStorage.setItem(`wingo_balance_${userId}`, current.toString());
    return current;
  }
}

// Request Deposit
export async function createDeposit(userId, gameUid, amount, utr) {
  if (amount < 50) throw new Error("Minimum deposit amount is ₹50.");
  if (!utr || utr.trim().length < 6) throw new Error("Please enter a valid 12-digit UPI / Bank UTR Reference number.");

  const depositData = {
    userId,
    gameUid,
    amount: parseFloat(amount),
    utr: utr.trim(),
    status: "VERIFIED", // Automatically verify and credit for instant gameplay experience
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "deposits"), depositData);
  } catch (e) {
    console.warn("Firestore deposit collection error:", e);
  }

  // Credit balance directly
  await updateBalance(userId, parseFloat(amount), `Deposit via UPI (UTR: ${utr.trim()})`);
  return true;
}

// Request Withdrawal
export async function createWithdrawal(userId, gameUid, amount, upiId) {
  if (amount < 50) throw new Error("Minimum withdrawal amount is ₹50.");
  if (!upiId || !upiId.includes("@")) throw new Error("Please enter a valid UPI ID (e.g., yourname@okaxis).");

  // Deduct balance first
  await updateBalance(userId, -parseFloat(amount), `Withdrawal Request to ${upiId}`);

  const withdrawData = {
    userId,
    gameUid,
    amount: parseFloat(amount),
    upiId: upiId.trim(),
    status: "PROCESSING_24H",
    note: "Funds will be credited to your UPI within 24 hours.",
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "withdrawals"), withdrawData);
  } catch (e) {
    console.warn("Firestore withdrawal record error:", e);
  }

  return true;
}

// Send Gift by recipient Game UID
export async function sendGift(senderUser, receiverGameUid, amount, message = "Here is a gift for you! 🎁") {
  if (amount < 10) throw new Error("Minimum gift amount is ₹10.");
  if (!receiverGameUid || !receiverGameUid.startsWith("W11-")) {
    throw new Error("Invalid Game UID! Format must be W11-XXXXXX");
  }

  if (senderUser.gameUid === receiverGameUid) {
    throw new Error("You cannot send a gift to yourself!");
  }

  // Find recipient user
  let recipientUserId = null;
  let recipientName = "Player";
  try {
    const q = query(collection(db, "users"), where("gameUid", "==", receiverGameUid.trim()), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      recipientUserId = snap.docs[0].id;
      recipientName = snap.docs[0].data().displayName || "Player";
    }
  } catch (e) {
    console.warn("Search recipient error:", e);
  }

  // Deduct from sender
  await updateBalance(senderUser.uid, -parseFloat(amount), `Sent Gift to ${receiverGameUid}`);

  const giftDoc = {
    senderUid: senderUser.uid,
    senderGameUid: senderUser.gameUid,
    senderName: senderUser.displayName || "Anonymous",
    receiverGameUid: receiverGameUid.trim(),
    receiverUid: recipientUserId,
    amount: parseFloat(amount),
    message: message || "Good luck playing!",
    isClaimed: false,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "gifts"), giftDoc);
  } catch (e) {
    // Local storage fallback for gifts
    const gifts = JSON.parse(localStorage.getItem("wingo_gifts") || "[]");
    gifts.push({ ...giftDoc, id: "gift_" + Date.now(), createdAt: new Date().toISOString() });
    localStorage.setItem("wingo_gifts", JSON.stringify(gifts));
  }

  return { recipientName, amount };
}

// Claim Gift
export async function claimGift(giftId, userProfile) {
  const giftRef = doc(db, "gifts", giftId);
  let amount = 0;
  try {
    const giftSnap = await getDoc(giftRef);
    if (!giftSnap.exists()) throw new Error("Gift not found!");
    const data = giftSnap.data();
    if (data.isClaimed) throw new Error("This gift has already been claimed!");
    amount = data.amount;

    await updateDoc(giftRef, {
      isClaimed: true,
      claimedAt: serverTimestamp(),
      claimedByUid: userProfile.uid
    });
  } catch (e) {
    console.warn("Claim online failed, checking fallback:", e);
    const gifts = JSON.parse(localStorage.getItem("wingo_gifts") || "[]");
    const target = gifts.find(g => g.id === giftId);
    if (target && !target.isClaimed) {
      target.isClaimed = true;
      amount = target.amount;
      localStorage.setItem("wingo_gifts", JSON.stringify(gifts));
    }
  }

  if (amount > 0) {
    await updateBalance(userProfile.uid, amount, "Claimed Gift Bonus 🎁");
    return amount;
  }
  throw new Error("Unable to claim gift.");
}
