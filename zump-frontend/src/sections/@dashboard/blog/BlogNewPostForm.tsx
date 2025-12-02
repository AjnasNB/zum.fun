import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
// form
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
// @mui
import { LoadingButton } from '@mui/lab';
import { 
  Grid, 
  Card, 
  Stack, 
  Button, 
  Typography, 
  Alert,
  Box,
  Divider,
  CircularProgress,
} from '@mui/material';
// routes
import { PATH_DASHBOARD } from '../../../routes/paths';
// hooks
import { useTokenLaunch, LaunchFormData, formatAmount } from '../../../hooks/useTokenLaunch';
import { useWallet } from '../../../hooks/useWallet';
// components
import { useSnackbar } from '../../../components/snackbar';
import FormProvider, {
  RHFSwitch,
  RHFEditor,
  RHFUpload,
  RHFTextField,
  RHFAutocomplete,
} from '../../../components/hook-form';
//
import BlogNewPostPreview from './BlogNewPostPreview';

// ----------------------------------------------------------------------

const TAGS_OPTION = [
  'DeFi',
  'Meme',
  'Gaming',
  'NFT',
  'Privacy',
  'AI',
  'Social',
  'Infrastructure',
  'DAO',
  'Metaverse',
];

// ----------------------------------------------------------------------

export interface TokenLaunchFormValues {
  // Token info
  title: string; // Token name
  symbol: string;
  description: string;
  content: string;
  cover: File | null;
  tags: string[];
  
  // Bonding curve parameters
  basePrice: string;
  slope: string;
  maxSupply: string;
  migrationThreshold: string;
  
  // Social links
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  
  // Options
  publish: boolean;
  fairlaunch: boolean;
  derivative: boolean;
  
  // Legacy fields for preview compatibility
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
}

export default function BlogNewPostForm() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isConnected, address } = useWallet();
  const { 
    launch, 
    estimateGas, 
    isLaunching, 
    isEstimating, 
    error: launchError,
    gasEstimate,
    transactionHash,
    tokenAddress,
    reset: resetLaunch,
  } = useTokenLaunch();

  const [openPreview, setOpenPreview] = useState(false);
  const [showGasEstimate, setShowGasEstimate] = useState(false);

  const NewTokenSchema = Yup.object().shape({
    title: Yup.string()
      .required('Token name is required')
      .max(31, 'Token name must be 31 characters or less'),
    symbol: Yup.string()
      .required('Symbol is required')
      .max(10, 'Symbol must be 10 characters or less')
      .matches(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters and numbers only'),
    description: Yup.string().required('Description is required'),
    tags: Yup.array().min(1, 'Must have at least 1 tag'),
    cover: Yup.mixed().nullable(),
    basePrice: Yup.string()
      .required('Base price is required')
      .matches(/^\d*\.?\d+$/, 'Must be a valid number'),
    slope: Yup.string()
      .required('Slope is required')
      .matches(/^\d*\.?\d+$/, 'Must be a valid number'),
    maxSupply: Yup.string()
      .required('Max supply is required')
      .matches(/^\d*\.?\d+$/, 'Must be a valid number'),
    migrationThreshold: Yup.string()
      .matches(/^\d*\.?\d*$/, 'Must be a valid number'),
  });

  const defaultValues: TokenLaunchFormValues = {
    title: '',
    symbol: '',
    description: '',
    content: '',
    cover: null,
    tags: [],
    basePrice: '0.000001',
    slope: '0.0000001',
    maxSupply: '1000000',
    migrationThreshold: '1000',
    websiteUrl: '',
    twitterUrl: '',
    telegramUrl: '',
    publish: true,
    fairlaunch: true,
    derivative: false,
    metaTitle: '',
    metaDescription: '',
    metaKeywords: [],
  };

  const methods = useForm<TokenLaunchFormValues>({
    resolver: yupResolver(NewTokenSchema) as any,
    defaultValues,
  });

  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting, isValid },
  } = methods;

  const values = watch();

  // Reset launch state when form is reset
  useEffect(() => {
    return () => {
      resetLaunch();
    };
  }, [resetLaunch]);

  const handleOpenPreview = () => {
    setOpenPreview(true);
  };

  const handleClosePreview = () => {
    setOpenPreview(false);
  };

  /**
   * Handle gas estimation before submit
   * Requirements: 2.4
   */
  const handleEstimateGas = async () => {
    if (!isConnected) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' });
      return;
    }

    try {
      const formData: LaunchFormData = {
        name: values.title,
        symbol: values.symbol,
        description: values.description,
        imageFile: values.cover || undefined,
        basePrice: values.basePrice,
        slope: values.slope,
        maxSupply: values.maxSupply,
        migrationThreshold: values.migrationThreshold || undefined,
        tags: values.tags,
        websiteUrl: values.websiteUrl || undefined,
        twitterUrl: values.twitterUrl || undefined,
        telegramUrl: values.telegramUrl || undefined,
      };

      await estimateGas(formData);
      setShowGasEstimate(true);
    } catch (err) {
      enqueueSnackbar('Failed to estimate gas', { variant: 'error' });
    }
  };

  /**
   * Handle token launch submission
   * Requirements: 2.1
   */
  const onSubmit = async (data: TokenLaunchFormValues) => {
    if (!isConnected) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' });
      return;
    }

    try {
      const formData: LaunchFormData = {
        name: data.title,
        symbol: data.symbol,
        description: data.description,
        imageFile: data.cover || undefined,
        basePrice: data.basePrice,
        slope: data.slope,
        maxSupply: data.maxSupply,
        migrationThreshold: data.migrationThreshold || undefined,
        tags: data.tags,
        websiteUrl: data.websiteUrl || undefined,
        twitterUrl: data.twitterUrl || undefined,
        telegramUrl: data.telegramUrl || undefined,
      };

      const result = await launch(formData);
      
      reset();
      handleClosePreview();
      enqueueSnackbar('Token launched successfully!', { variant: 'success' });
      
      // Navigate to token detail page
      // Requirements: 2.5
      if (result.tokenAddress && result.tokenAddress !== '0x0') {
        navigate(PATH_DASHBOARD.dn404.view(result.tokenAddress));
      } else {
        navigate(PATH_DASHBOARD.dn404.bondingCurve);
      }
    } catch (err) {
      console.error('Launch error:', err);
      enqueueSnackbar(
        err instanceof Error ? err.message : 'Failed to launch token', 
        { variant: 'error' }
      );
    }
  };

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];

      const newFile = Object.assign(file, {
        preview: URL.createObjectURL(file),
      });

      if (file) {
        setValue('cover', newFile as any, { shouldValidate: true });
      }
    },
    [setValue]
  );

  const handleRemoveFile = () => {
    setValue('cover', null);
  };

  return (
    <FormProvider methods={methods} onSubmit={handleSubmit(onSubmit)}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 3 }}>
            <Stack spacing={3}>
              {/* Wallet Connection Warning */}
              {!isConnected && (
                <Alert severity="warning">
                  Please connect your wallet to launch a token
                </Alert>
              )}

              {/* Launch Error */}
              {launchError && (
                <Alert severity="error" onClose={() => resetLaunch()}>
                  {launchError.message}
                </Alert>
              )}

              {/* Token Name */}
              <RHFTextField 
                name="title" 
                label="Token Name" 
                helperText="Max 31 characters"
              />

              {/* Token Symbol */}
              <RHFTextField 
                name="symbol" 
                label="Token Symbol" 
                helperText="Uppercase letters and numbers only (e.g., ZUMP)"
                inputProps={{ style: { textTransform: 'uppercase' } }}
              />

              {/* Description */}
              <RHFTextField 
                name="description" 
                label="Description" 
                multiline 
                rows={3} 
              />

              {/* Rich Content */}
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                  Detailed Content (Optional)
                </Typography>
                <RHFEditor simple name="content" />
              </Stack>

              {/* Token Image */}
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                  Token Image
                </Typography>
                <RHFUpload
                  name="cover"
                  maxSize={3145728}
                  onDrop={handleDrop}
                  onDelete={handleRemoveFile}
                />
              </Stack>

              <Divider />

              {/* Bonding Curve Parameters */}
              <Typography variant="h6">Bonding Curve Parameters</Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <RHFTextField 
                    name="basePrice" 
                    label="Base Price (STRK)" 
                    type="text"
                    helperText="Starting price per token"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <RHFTextField 
                    name="slope" 
                    label="Slope" 
                    type="text"
                    helperText="Price increase per token sold"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <RHFTextField 
                    name="maxSupply" 
                    label="Max Supply" 
                    type="text"
                    helperText="Maximum tokens available"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <RHFTextField 
                    name="migrationThreshold" 
                    label="Migration Threshold" 
                    type="text"
                    helperText="Tokens sold before DEX migration"
                  />
                </Grid>
              </Grid>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3 }}>
            <Stack spacing={3}>
              {/* Launch Options */}
              <div>
                <RHFSwitch
                  name="publish"
                  label="Publish Immediately"
                  labelPlacement="start"
                  sx={{ mb: 0, mx: 0, width: 1, justifyContent: 'space-between' }}
                />

                <RHFSwitch
                  name="fairlaunch"
                  label="Fairlaunch (Recommended)"
                  labelPlacement="start"
                  sx={{ mx: 0, width: 1, justifyContent: 'space-between' }}
                />

                <RHFSwitch
                  name="derivative"
                  label="Community Derivative"
                  labelPlacement="start"
                  sx={{ mx: 0, width: 1, justifyContent: 'space-between' }}
                />
              </div>

              {/* Tags */}
              <RHFAutocomplete
                name="tags"
                label="Tags"
                multiple
                freeSolo
                options={TAGS_OPTION}
                ChipProps={{ size: 'small' }}
              />

              <Divider />

              {/* Social Links */}
              <Typography variant="subtitle2">Social Links (Optional)</Typography>
              
              <RHFTextField name="websiteUrl" label="Website URL" />
              <RHFTextField name="twitterUrl" label="Twitter URL" />
              <RHFTextField name="telegramUrl" label="Telegram URL" />

              {/* Gas Estimate Display */}
              {showGasEstimate && gasEstimate && (
                <Box sx={{ p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Estimated Gas Cost
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fee: {gasEstimate.estimatedFeeFormatted} STRK
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Max Fee: {gasEstimate.suggestedMaxFeeFormatted} STRK
                  </Typography>
                </Box>
              )}

              {/* Transaction Status */}
              {transactionHash && (
                <Alert severity="info">
                  Transaction submitted: {transactionHash.slice(0, 10)}...
                </Alert>
              )}
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
              <Button
                fullWidth
                color="inherit"
                variant="outlined"
                size="large"
                onClick={handleOpenPreview}
              >
                Preview
              </Button>

              <Button
                fullWidth
                color="info"
                variant="outlined"
                size="large"
                onClick={handleEstimateGas}
                disabled={!isValid || isEstimating || !isConnected}
              >
                {isEstimating ? (
                  <CircularProgress size={24} />
                ) : (
                  'Estimate Gas'
                )}
              </Button>
            </Stack>

            <LoadingButton
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              loading={isLaunching || isSubmitting}
              disabled={!isConnected}
              sx={{ mt: 2 }}
            >
              Launch Token
            </LoadingButton>
          </Card>
        </Grid>
      </Grid>

      <BlogNewPostPreview
        values={{
          title: values.title,
          description: values.description,
          content: values.content,
          cover: values.cover,
          tags: values.tags,
          publish: values.publish,
          comments: true,
          metaTitle: values.metaTitle,
          metaDescription: values.metaDescription,
          metaKeywords: values.metaKeywords || [],
        }}
        open={openPreview}
        isValid={isValid}
        isSubmitting={isLaunching || isSubmitting}
        onClose={handleClosePreview}
        onSubmit={handleSubmit(onSubmit)}
      />
    </FormProvider>
  );
}
