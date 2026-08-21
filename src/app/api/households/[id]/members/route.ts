// src/app/api/households/[id]/members/route.ts
import { NextResponse } from "next/server";
import {
  withAuthParams,
  checkHouseholdAccess,
  errorResponse,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// --- Interfaces (Supabase snake_case) ---
interface ProfileData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

interface FormattedMember {
  id: string; // household_members ID
  userId: string;
  role: string;
  joined_at: string;
  name: string;
  email: string;
  avatar: string | null;
  created_at: string; // User's creation date
}

const VALID_ROLES = ["admin", "member"];

async function fetchFormattedMembers(
  supabase: SupabaseServerClient,
  householdId: string,
): Promise<{ members: FormattedMember[] | null; error: string | null }> {
  const { data: members, error: membersError } = await supabase
    .from("household_members")
    .select("id, user_id, role, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: false });

  if (membersError) {
    console.error("Error fetching household members:", membersError);
    return { members: null, error: "Failed to fetch household members" };
  }

  const userIds = (members || []).map((m) => m.user_id).filter(Boolean);
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, name, email, avatar_url, created_at")
          .in("id", userIds)
      : { data: [] as ProfileData[] };

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p as ProfileData]),
  );

  const formattedMembers: FormattedMember[] = (members || []).map((member) => {
    const profile = profileMap.get(member.user_id);
    if (!profile) {
      console.warn(`Profile not found for user_id: ${member.user_id}`);
    }
    return {
      id: member.id,
      userId: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      name: profile?.name || "Unknown User",
      email: profile?.email || "",
      avatar: profile?.avatar_url ?? null,
      created_at: profile?.created_at || member.joined_at,
    };
  });

  return { members: formattedMembers, error: null };
}

// GET /api/households/[id]/members - Get all members of a household
export const GET = withAuthParams<Promise<{ id: string }>>(
  async (_request, user, supabase, params) => {
    const { id: householdId } = await params;

    if (!householdId || householdId === "undefined") {
      return errorResponse("Valid household ID required", 400);
    }

    const access = await checkHouseholdAccess(supabase, householdId, user.id);
    if (!access.authorized) {
      return errorResponse(access.error!, access.status);
    }

    const { members, error } = await fetchFormattedMembers(
      supabase,
      householdId,
    );
    if (error || !members) {
      return errorResponse(error || "Failed to fetch household members");
    }

    return NextResponse.json(members);
  },
);

// POST /api/households/[id]/members - Add a member to the household (Manual Add)
export const POST = withAuthParams<Promise<{ id: string }>>(
  async (request, user, supabase, params) => {
    const { id: householdId } = await params;

    if (!householdId || householdId === "undefined") {
      return errorResponse("Household ID required", 400);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { email, role = "member" } = payload;

    if (!email) {
      return errorResponse("Email is required", 400);
    }

    const normalizedRole = role?.toLowerCase();
    if (!VALID_ROLES.includes(normalizedRole)) {
      return errorResponse("Invalid role specified", 400);
    }

    // Only household admins can add members directly
    const access = await checkHouseholdAccess(
      supabase,
      householdId,
      user.id,
      true,
    );
    if (!access.authorized) {
      return errorResponse(access.error!, access.status);
    }

    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      console.error("Target user lookup error:", userError);
      return errorResponse("Failed to find user by email");
    }

    if (!targetUser) {
      return errorResponse("User with specified email not found", 404);
    }

    const { data: existingMember, error: existingError } = await supabase
      .from("household_members")
      .select("id")
      .eq("user_id", targetUser.id)
      .eq("household_id", householdId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("Existing member check error:", existingError);
      return errorResponse("Failed to check existing membership");
    }

    if (existingMember) {
      return errorResponse("User is already a member of this household", 409);
    }

    const { data: newMember, error: addError } = await supabase
      .from("household_members")
      .insert({
        user_id: targetUser.id,
        household_id: householdId,
        role: normalizedRole, // DB uses lowercase: 'admin', 'member'
      })
      .select("id, user_id, household_id, role, joined_at")
      .single();

    if (addError || !newMember) {
      console.error("Error adding member to household:", addError);
      return errorResponse("Failed to add member to household");
    }

    return NextResponse.json(
      {
        ...newMember,
        userId: newMember.user_id,
        joined_at: newMember.joined_at,
        name: targetUser.name,
        email: targetUser.email,
        avatar: null,
      },
      { status: 201 },
    );
  },
);

// PATCH /api/households/[id]/members?userId={memberUserId} - Update member role
export const PATCH = withAuthParams<Promise<{ id: string }>>(
  async (request, user, supabase, params) => {
    const { id: householdId } = await params;

    if (!householdId || householdId === "undefined") {
      return errorResponse("Household ID required in path", 400);
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return errorResponse("Target userId required as query parameter", 400);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { role } = payload;
    const normalizedRole = role?.toLowerCase();
    if (!normalizedRole || !VALID_ROLES.includes(normalizedRole)) {
      return errorResponse("Invalid role specified in body", 400);
    }

    // Only household admins can update member roles
    const access = await checkHouseholdAccess(
      supabase,
      householdId,
      user.id,
      true,
    );
    if (!access.authorized) {
      return errorResponse(access.error!, access.status);
    }

    if (targetUserId === user.id) {
      return errorResponse(
        "Admins cannot change their own role via this endpoint",
        400,
      );
    }

    const { data: updatedMember, error: updateError } = await supabase
      .from("household_members")
      .update({ role: normalizedRole })
      .eq("user_id", targetUserId)
      .eq("household_id", householdId)
      .select("id, user_id, household_id, role, joined_at")
      .single();

    if (updateError) {
      console.error("Error updating member role:", updateError);
      if (updateError.code === "PGRST116") {
        return errorResponse(
          "Target member not found in this household, or update failed",
          404,
        );
      }
      return errorResponse("Failed to update member role");
    }

    if (!updatedMember) {
      return errorResponse("Failed to update member role (no data returned)");
    }

    return NextResponse.json({
      ...updatedMember,
      userId: updatedMember.user_id,
      joined_at: updatedMember.joined_at,
    });
  },
);

// DELETE /api/households/[id]/members?userId={memberUserId} - Remove a member
export const DELETE = withAuthParams<Promise<{ id: string }>>(
  async (request, user, supabase, params) => {
    const { id: householdId } = await params;

    if (!householdId || householdId === "undefined") {
      return errorResponse("Household ID required in path", 400);
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return errorResponse("Target userId required as query parameter", 400);
    }

    const access = await checkHouseholdAccess(supabase, householdId, user.id);
    if (!access.authorized) {
      return errorResponse(access.error!, access.status);
    }

    const isRemovingSelf = targetUserId === user.id;
    const isAdmin = access.membership!.role === "admin";

    // Must be removing self OR be an admin removing someone else
    if (!isRemovingSelf && !isAdmin) {
      return errorResponse(
        "Only household admins can remove other members",
        403,
      );
    }

    const { data: memberToRemove, error: memberCheckError } = await supabase
      .from("household_members")
      .select("user_id, role")
      .eq("user_id", targetUserId)
      .eq("household_id", householdId)
      .maybeSingle();

    if (memberCheckError) {
      console.error("Target member check error:", memberCheckError);
      return errorResponse("Failed to check target member details");
    }

    if (!memberToRemove) {
      return errorResponse("Member to remove not found in this household", 404);
    }

    // Prevent removing the last admin
    if (memberToRemove.role === "admin") {
      const { count: adminCount, error: countError } = await supabase
        .from("household_members")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId)
        .eq("role", "admin");

      if (countError || adminCount === null) {
        console.error("Admin count error:", countError);
        return errorResponse("Failed to verify admin count");
      }

      if (adminCount <= 1) {
        return errorResponse(
          "Cannot remove the last admin. Assign another admin first or delete the household.",
          400,
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("household_members")
      .delete()
      .eq("user_id", targetUserId)
      .eq("household_id", householdId);

    if (deleteError) {
      console.error("Error removing household member:", deleteError);
      return errorResponse("Failed to remove household member");
    }

    return NextResponse.json(
      {
        message: "Member removed successfully",
        removed: { userId: targetUserId, householdId },
      },
      { status: 200 },
    );
  },
);
