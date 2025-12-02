// Starknet wallet buttons - replacing wagmi/web3modal
import React from 'react';
import { Stack, Button } from '@mui/material';
import { useAccount, useDisconnect } from '@starknet-react/core';
import { useWallet } from '../hooks/useWallet';

export function Web3ModalWalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useWallet();

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={() => disconnect()}
          sx={{ color: 'text.primary' }}
        >
          {formatAddress(address)}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack>
      <Button
        variant="contained"
        color="primary"
        onClick={connect}
      >
        Connect Wallet
      </Button>
    </Stack>
  );
}

export function Web3ModalNetworkButton() {
  const { isConnected } = useAccount();
  
  if (!isConnected) return null;
  
  return (
    <Stack>
      <Button variant="text" color="inherit" size="small">
        Starknet
      </Button>
    </Stack>
  );
}
