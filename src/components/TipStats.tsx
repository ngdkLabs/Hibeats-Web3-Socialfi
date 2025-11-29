/**
 * Tip Stats Component
 * 
 * Display tip statistics for posts, tracks, albums, or artists
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TipTarget } from '@/services/tipService';
import { useTips } from '@/hooks/useTips';
import { DollarSign, TrendingUp, Users, Clock } from 'lucide-react';

interface TipStatsProps {
  targetType: TipTarget;
  targetId: number | string;
  compact?: boolean;
}

export const TipStats: React.FC<TipStatsProps> = ({
  targetType,
  targetId,
  compact = false,
}) => {
  const { stats, isLoading, formatAmount } = useTips(targetType, targetId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (stats.tipCount === 0 && compact) {
    return null;
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-green-500" />
          <span className="font-medium">{formatAmount(stats.totalAmount)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{stats.tipCount} tips</span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          Support Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Support</p>
            <p className="text-2xl font-bold text-green-500">
              {formatAmount(stats.totalAmount)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Supporters</p>
            <p className="text-2xl font-bold">{stats.tipCount}</p>
          </div>
        </div>

        {/* Top Supporters */}
        {stats.topTippers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <h4 className="font-medium">Top Supporters</h4>
            </div>
            <div className="space-y-2">
              {stats.topTippers.slice(0, 5).map((tipper, index) => (
                <div
                  key={tipper.address}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center p-0">
                    {index + 1}
                  </Badge>
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">
                      {tipper.address.slice(2, 4).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tipper.address.slice(0, 8)}...{tipper.address.slice(-6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tipper.tipCount} tips
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-500">
                      {formatAmount(tipper.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tips */}
        {stats.recentTips.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <h4 className="font-medium">Recent Support</h4>
            </div>
            <div className="space-y-2">
              {stats.recentTips.slice(0, 5).map((tip, index) => (
                <div
                  key={`${tip.from}-${tip.timestamp}-${index}`}
                  className="p-3 rounded-lg bg-muted/50 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">
                          {tip.from.slice(2, 4).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {tip.from.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-500">
                        {formatAmount(tip.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(tip.timestamp)}
                      </span>
                    </div>
                  </div>
                  {tip.message && (
                    <p className="text-sm text-muted-foreground italic pl-8">
                      "{tip.message}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {stats.tipCount === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No support yet</p>
            <p className="text-xs">Be the first to show your support!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TipStats;
