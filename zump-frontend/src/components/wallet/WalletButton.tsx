/**
 * WalletButton Component
 * Displays wallet connection button with address display, stealth address generation, and disconnect functionality
 * Requirements: 1.1, 1.3, 1.4, 10.3
 */

import React, { useState } from 'react';
import {
  Button,
  Box,
  Typography,
  CircularProgress,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Badge,
} from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useWallet } from '../../hooks/useWallet';
import { useStealthAddress } from '../../hooks/useStealthAddress';
import { StealthAddressPanel } from '../privacy/StealthAddressPanel';

export function WalletButton() {
  const { 
    isConnected, 
    isConnecting, 
    shortAddress, 
    connector,
    connect, 
    disconnect 
  } = useWallet();

  const { stealthAddresses } = useStealthAddress();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [stealthDialogOpen, setStealthDialogOpen] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isConnected) {
      setAnchorEl(event.currentTarget);
    } else {
      connect();
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDisconnect = async () => {
    handleClose();
    await disconnect();
  };

  const handleOpenStealthDialog = () => {
    handleClose();
    setStealthDialogOpen(true);
  };

  const handleCloseStealthDialog = () => {
    setStealthDialogOpen(false);
  };

  if (isConnecting) {
    return (
      <Button
        variant="contained"
        disabled
        sx={{
          bgcolor: 'primary.main',
          borderRadius: 2,
          px: 3,
          py: 1,
        }}
      >
        <CircularProgress size={20} sx={{ mr: 1 }} />
        Connecting...
      </Button>
    );
  }

  if (isConnected && shortAddress) {
    return (
      <Box>
        <Badge
          badgeContent={stealthAddresses.length}
          color="secondary"
          invisible={stealthAddresses.length === 0}
        >
          <Button
            variant="contained"
            onClick={handleClick}
            sx={{
              bgcolor: 'success.main',
              borderRadius: 2,
              px: 3,
              py: 1,
              '&:hover': {
                bgcolor: 'success.dark',
              },
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>
                {connector}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {shortAddress}
              </Typography>
            </Box>
          </Button>
        </Badge>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleOpenStealthDialog}>
            <VisibilityOffIcon sx={{ mr: 1, fontSize: 20 }} />
            Stealth Adresler ({stealthAddresses.length})
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleDisconnect}>Disconnect</MenuItem>
        </Menu>

        {/* Stealth Address Dialog */}
        <Dialog
          open={stealthDialogOpen}
          onClose={handleCloseStealthDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VisibilityOffIcon />
              Stealth Adres Yönetimi
            </Box>
          </DialogTitle>
          <DialogContent>
            <StealthAddressPanel />
          </DialogContent>
        </Dialog>
      </Box>
    );
  }

  return (
    <Button
      variant="contained"
      onClick={handleClick}
      sx={{
        bgcolor: 'primary.main',
        borderRadius: 2,
        px: 3,
        py: 1,
        '&:hover': {
          bgcolor: 'primary.dark',
        },
      }}
    >
      Connect Wallet
    </Button>
  );
}

export default WalletButton;
