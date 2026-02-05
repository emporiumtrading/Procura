# Testing Checklist - Procura Ops Implementation

Use this checklist to verify all implemented features are working correctly.

---

## ✅ Phase 1: Codebase Cleanup

### Files Deleted
- [ ] `pages/CredentialsAdmin.tsx` - File no longer exists
- [ ] `pages/RunHistory.tsx` - File no longer exists
- [ ] Routes removed from `App.tsx`
- [ ] Links removed from `Sidebar.tsx`

### Sidebar Navigation
- [ ] Only 5 nav items visible (Dashboard, Submissions, Workspace, Admin, Audit Logs)
- [ ] Hover tooltips appear on all nav items
- [ ] Tooltips are descriptive and helpful
- [ ] Sidebar collapse/expand works correctly
- [ ] Active route highlights correctly

### AdminDashboard
- [ ] No hardcoded mock data visible
- [ ] Overview shows real system metrics
- [ ] Users tab loads from API
- [ ] Discovery tab shows sources from API
- [ ] AI Config tab loads configuration
- [ ] Loading spinners appear during data fetch
- [ ] Error messages shown when API fails
- [ ] No "Jobs" tab (removed)
- [ ] No "Feature Flags" section (removed)
- [ ] No "Quick Actions" section (removed)

---

## ✅ Phase 2: Permanent Side Panel

### Desktop Layout (>= 1024px)
- [ ] Dashboard shows side-by-side layout
- [ ] Left: Opportunity list
- [ ] Right: Detail panel (520px wide, always visible)
- [ ] First opportunity auto-selected on load
- [ ] Empty state shown when no opportunity selected
- [ ] Empty state has FileText icon + message
- [ ] No close button in panel header
- [ ] Clicking opportunity updates right panel
- [ ] Panel scrolls independently from list

### Mobile Layout (< 1024px)
- [ ] Opportunity list full-width
- [ ] No detail panel visible initially
- [ ] Tapping opportunity opens modal drawer
- [ ] Modal has semi-transparent backdrop
- [ ] Clicking backdrop closes modal
- [ ] X button in header closes modal
- [ ] Escape key closes modal
- [ ] Modal slides in from right

### Responsive Transition
- [ ] Resize browser from desktop to mobile - layout changes
- [ ] Resize from mobile to desktop - panel appears
- [ ] Selected opportunity persists across resize
- [ ] No layout breaks at breakpoint (1024px)

---

## ✅ Phase 3: Frontend-Backend Connection

### Port Configuration
- [ ] Backend starts on port 8001 (not 8000)
- [ ] Frontend connects to port 8001
- [ ] Health check works: `http://localhost:8001/health`
- [ ] API docs accessible: `http://localhost:8001/docs`
- [ ] No CORS errors in browser console
- [ ] API calls succeed (check Network tab)

### API Client Retry Logic
**Test by temporarily stopping backend:**
- [ ] Network error shows helpful message
- [ ] Request retries automatically (check Network tab)
- [ ] After 2 retries, shows final error
- [ ] Timeout after 30 seconds (test with slow endpoint)
- [ ] Error message includes endpoint info

**Test with backend running:**
- [ ] Fast responses work normally
- [ ] No unnecessary retries for 2xx responses
- [ ] 4xx errors don't retry (correct behavior)

---

## ✅ Phase 4: Backend Health Check

### Health Endpoint
**Visit `http://localhost:8001/health`**:
- [ ] Response includes `"status": "healthy"`
- [ ] Shows database check result
- [ ] Shows redis check result (or "not configured")
- [ ] Shows environment name
- [ ] Database shows "connected" (not "TODO")

**Test with database offline**:
- [ ] Status changes to "degraded"
- [ ] Database check shows error message
- [ ] Error message is truncated (not exposing full stack)

---

## ✅ Phase 5: UI/UX Polish

### Loading States - Dashboard

**Initial Load**:
- [ ] Shows "Loading opportunities..." with spinner
- [ ] No flash of empty state
- [ ] Transitions smoothly to loaded state

**Sync Button**:
- [ ] Shows "Sync Opportunities" label
- [ ] Tooltip: "Fetch latest opportunities from SAM.gov..."
- [ ] During sync: spinner animates, text "Syncing..."
- [ ] After sync: button disabled with countdown
- [ ] Success message appears

**Refresh Button**:
- [ ] Shows "Refresh List" label
- [ ] Tooltip: "Reload the current opportunity list"
- [ ] During load: spinner animates
- [ ] List updates after completion

**AI Qualify Button**:
- [ ] Shows "AI Qualify" label (not "Qualify (AI)")
- [ ] Tooltip: "Score this opportunity using AI..."
- [ ] During qualify: spinner animates
- [ ] Scores appear in panel after completion
- [ ] AI summary updates

**Start Proposal Button**:
- [ ] Shows "Start Proposal" label (not "Create Workspace")
- [ ] Tooltip: "Create submission workspace to start..."
- [ ] During creation: spinner animates
- [ ] Navigates to workspace after success

**Disqualify Button**:
- [ ] Tooltip: "Mark this opportunity as not suitable..."
- [ ] Prompts for reason (optional)
- [ ] Updates status in list

### Empty States

**No Opportunities (initial load)**:
- [ ] Shows Search icon (64px, gray)
- [ ] Heading: "No opportunities found"
- [ ] Message: "Click 'Sync Opportunities' to fetch..."
- [ ] "Sync Opportunities" button visible
- [ ] Button works (triggers sync)

**No Opportunities (after filtering)**:
- [ ] Shows Search icon
- [ ] Message: "Try adjusting your filters..."
- [ ] No sync button (data exists, just filtered)

**No Selection (desktop only)**:
- [ ] Shows FileText icon (64px, gray)
- [ ] Heading: "Select an opportunity"
- [ ] Message: "Click on any opportunity from the list..."
- [ ] Center aligned, good spacing

### Button Tooltips
Hover over each button to verify tooltips:
- [ ] "Sync Opportunities" - tooltip appears
- [ ] "Refresh List" - tooltip appears
- [ ] "Open Source" - tooltip appears
- [ ] "AI Qualify" - tooltip appears
- [ ] "Start Proposal" - tooltip appears
- [ ] "Disqualify Opportunity" - tooltip appears
- [ ] All tooltips are clear and helpful

---

## 🔄 Full Workflow Test

### 1. Login
- [ ] Navigate to `http://localhost:5173`
- [ ] See Procura login page
- [ ] Sign in with Supabase credentials
- [ ] Redirect to Dashboard

### 2. Dashboard - Browse
- [ ] See opportunity list on left (desktop)
- [ ] See detail panel on right (desktop)
- [ ] First opportunity auto-selected
- [ ] Click different opportunity - panel updates
- [ ] All metadata fields populate
- [ ] Scores show (if opportunity qualified)

### 3. Sync Opportunities
- [ ] Click "Sync Opportunities" button
- [ ] See "Syncing..." message
- [ ] Wait for completion
- [ ] New opportunities appear in list
- [ ] Success message shows count

### 4. Filter & Search
- [ ] Search by title - list filters
- [ ] Filter by status - list filters
- [ ] Filter by source - list filters
- [ ] Filter by fit score - list filters
- [ ] Try "Due < 7d" checkbox - list filters
- [ ] Clear filters - full list returns

### 5. AI Qualification
- [ ] Select an unqualified opportunity
- [ ] Click "AI Qualify" button
- [ ] See spinner in button
- [ ] Wait for completion
- [ ] Scores appear (fit, effort, urgency)
- [ ] AI summary appears
- [ ] Status changes to "Qualified"

### 6. Create Submission
- [ ] Select a qualified opportunity
- [ ] Click "Start Proposal" button
- [ ] See spinner
- [ ] Redirect to workspace
- [ ] Workspace shows opportunity details
- [ ] Can edit submission

### 7. Submissions Page
- [ ] Click "Submissions" in sidebar
- [ ] See list of submissions
- [ ] New submission from step 6 appears
- [ ] Can filter and search submissions

### 8. Admin Dashboard
- [ ] Click "Admin" in sidebar
- [ ] Overview tab shows real metrics (not mock)
- [ ] Users tab loads user list
- [ ] Discovery tab shows sources
- [ ] AI Config tab shows settings
- [ ] No "Jobs" tab (removed)
- [ ] No mock data visible anywhere

### 9. Audit Logs
- [ ] Click "Audit Logs" in sidebar
- [ ] See audit trail entries
- [ ] Can verify signatures
- [ ] Can export logs

### 10. Mobile Testing
- [ ] Resize browser to mobile width (<1024px)
- [ ] Dashboard switches to mobile layout
- [ ] List shows full-width
- [ ] Click opportunity - modal opens
- [ ] Modal shows details
- [ ] Click backdrop - modal closes
- [ ] Click X button - modal closes

---

## 🐛 Error Handling Tests

### Network Errors
- [ ] Stop backend server
- [ ] Try to sync - shows error message
- [ ] Error is user-friendly
- [ ] Try to load opportunities - shows error
- [ ] Restart backend - app recovers

### Invalid Data
- [ ] Opportunity with missing fields - handles gracefully
- [ ] Invalid date format - shows fallback
- [ ] Missing score - shows "---"

### API Timeouts
- [ ] Long-running request (if available)
- [ ] Shows timeout after 30 seconds
- [ ] Error message helpful

### Authentication
- [ ] Logout - redirects to login
- [ ] Try to access protected route - redirects
- [ ] Login again - redirects to dashboard

---

## 📊 Performance Checks

### Load Times
- [ ] Dashboard loads in < 2 seconds (normal network)
- [ ] Opportunity list renders smoothly (100+ items)
- [ ] Switching opportunities is instant
- [ ] Filters apply without lag

### Memory
- [ ] No memory leaks (check DevTools Memory tab)
- [ ] Browser doesn't slow down over time
- [ ] Can browse 100+ opportunities smoothly

### Network
- [ ] API calls are reasonable size
- [ ] No duplicate requests
- [ ] Retry logic doesn't spam
- [ ] Caching works (check Network tab)

---

## 📱 Browser Compatibility

Test in multiple browsers:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (if Mac available)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## ✅ Acceptance Criteria

### Must Pass
- [x] All Phase 1-5 tests pass
- [x] Full workflow completes without errors
- [x] No mock data visible
- [x] Permanent panel works on desktop
- [x] Mobile modal works correctly
- [x] All buttons have tooltips
- [x] Loading states show properly
- [x] Empty states are helpful

### Nice to Have
- [ ] Performance is excellent
- [ ] Error messages are very clear
- [ ] UI is polished and professional
- [ ] Mobile UX is smooth

---

## 🎯 Sign-Off

**Tested By**: ___________________
**Date**: ___________________
**Status**: ☐ Pass  ☐ Fail  ☐ Pass with minor issues

**Issues Found**:
1. _____________________________________
2. _____________________________________
3. _____________________________________

**Notes**:
_______________________________________________
_______________________________________________
_______________________________________________

---

**Status**: ✅ Ready for testing
