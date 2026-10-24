use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TorrentState {
    AddedPending,
    MetadataFetch,
    AwaitingConfirm, // Mandatory before disk allocation (INV-04)
    Allocating,
    Checking,
    Downloading,
    Paused,
    Completing,
    Seeding,
    Stopped,
    Rejected,
    TimedOut,
    Cancelled,
    DiskError,
    Suspect, // Flagged after an engine crash while active (INV-14)
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum StateTransitionError {
    #[error("Invalid state transition from {from:?} to {to:?}")]
    InvalidTransition {
        from: TorrentState,
        to: TorrentState,
    },
    #[error("Action prohibited: torrent is flagged as SUSPECT due to previous crash")]
    SuspectRequiresUserAction,
}

impl TorrentState {
    /// Validates and applies a state transition according to docs/PLAN.md Section 16.3
    pub fn transition_to(&self, next: TorrentState) -> Result<TorrentState, StateTransitionError> {
        if *self == TorrentState::Suspect && next != TorrentState::Paused && next != TorrentState::Stopped {
            return Err(StateTransitionError::SuspectRequiresUserAction);
        }

        let valid = match (*self, next) {
            // Standard forward lifecycle
            (TorrentState::AddedPending, TorrentState::MetadataFetch) => true,
            (TorrentState::AddedPending, TorrentState::AwaitingConfirm) => true,
            (TorrentState::AddedPending, TorrentState::Rejected) => true,

            (TorrentState::MetadataFetch, TorrentState::AwaitingConfirm) => true,
            (TorrentState::MetadataFetch, TorrentState::TimedOut) => true,
            (TorrentState::MetadataFetch, TorrentState::Cancelled) => true,

            (TorrentState::AwaitingConfirm, TorrentState::Allocating) => true,
            (TorrentState::AwaitingConfirm, TorrentState::Cancelled) => true,

            (TorrentState::Allocating, TorrentState::Checking) => true,
            (TorrentState::Allocating, TorrentState::DiskError) => true,

            (TorrentState::Checking, TorrentState::Downloading) => true,
            (TorrentState::Checking, TorrentState::Seeding) => true,
            (TorrentState::Checking, TorrentState::DiskError) => true,

            // Active downloads and pause toggles
            (TorrentState::Downloading, TorrentState::Paused) => true,
            (TorrentState::Paused, TorrentState::Downloading) => true,
            (TorrentState::Downloading, TorrentState::Completing) => true,
            (TorrentState::Downloading, TorrentState::DiskError) => true,

            // Seeding and stop
            (TorrentState::Completing, TorrentState::Seeding) => true,
            (TorrentState::Seeding, TorrentState::Paused) => true,
            (TorrentState::Paused, TorrentState::Seeding) => true,
            (TorrentState::Seeding, TorrentState::Stopped) => true,
            (TorrentState::Paused, TorrentState::Stopped) => true,

            // Any active state transitions to SUSPECT on engine crash (INV-14)
            (TorrentState::Downloading, TorrentState::Suspect)
            | (TorrentState::Allocating, TorrentState::Suspect)
            | (TorrentState::Checking, TorrentState::Suspect)
            | (TorrentState::Completing, TorrentState::Suspect)
            | (TorrentState::Seeding, TorrentState::Suspect) => true,

            // Manual recovery from SUSPECT
            (TorrentState::Suspect, TorrentState::Paused) => true,
            (TorrentState::Suspect, TorrentState::Stopped) => true,

            // Self transition
            (s, n) if s == n => true,

            _ => false,
        };

        if valid {
            Ok(next)
        } else {
            Err(StateTransitionError::InvalidTransition {
                from: *self,
                to: next,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_lifecycle() {
        let state = TorrentState::AddedPending;
        let state = state.transition_to(TorrentState::MetadataFetch).unwrap();
        let state = state.transition_to(TorrentState::AwaitingConfirm).unwrap();
        let state = state.transition_to(TorrentState::Allocating).unwrap();
        let state = state.transition_to(TorrentState::Checking).unwrap();
        let state = state.transition_to(TorrentState::Downloading).unwrap();
        let state = state.transition_to(TorrentState::Completing).unwrap();
        let state = state.transition_to(TorrentState::Seeding).unwrap();
        assert_eq!(state, TorrentState::Seeding);
    }

    #[test]
    fn test_engine_crash_flagged_as_suspect() {
        let downloading = TorrentState::Downloading;
        let suspect = downloading.transition_to(TorrentState::Suspect).unwrap();
        assert_eq!(suspect, TorrentState::Suspect);

        // Cannot resume directly to downloading without clearing suspect status
        assert!(suspect.transition_to(TorrentState::Downloading).is_err());

        // Can transition to Paused upon user action
        let paused = suspect.transition_to(TorrentState::Paused).unwrap();
        assert_eq!(paused, TorrentState::Paused);
    }
}
